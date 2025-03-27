const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const multer = require('multer');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();
const path = require('path');
const axios = require('axios');
const fs = require('fs');

const SentMail = require('./models/SentMail');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket'],  // Force WebSocket transport
});


// 1) Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully!'))
.catch((error) => console.error('MongoDB connection error:', error));

// 2) Configure CORS
const corsOptions = {
  origin: '*', // This should be your frontend's URL
  credentials: true // If you're using cookies or authentication, set this to true
};

app.use(cors(corsOptions));

// 3) Multer setup: Only one Excel file is uploaded
const upload = multer({ storage: multer.memoryStorage() });

// 4) Nodemailer transporter (using Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

/**
 * Helper to replace placeholders in the email body.
 * If the template has "Dear {{NAME}}" & rowData = { NAME: "Alice" }, returns "Dear Alice".
 */
function replacePlaceholders(template, rowData) {
  let output = template;
  for (const key of Object.keys(rowData)) {
    const placeholder = `{{${key}}}`;
    const regex = new RegExp(placeholder, 'g');
    output = output.replace(regex, rowData[key] || '');
  }
  return output;
}

/**
 * Retry helper for temporary SMTP errors
 */
async function retrySend(mailOptions, retries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      return;
    } catch (error) {
      console.error(`Error sending mail to ${mailOptions.to}:`, error.message);
      if (error.responseCode === 421 && attempt < retries) {
        console.warn(`Temporary error. Retrying attempt ${attempt}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw error;
      }
    }
  }
}

/**
 * Helper function to download a file from Dropbox
 */
const downloadFileFromDropbox = async (fileUrl) => {
  const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
  return Buffer.from(response.data); // Returns the file as a buffer
};

/**
 * POST /upload-campaign
 * Expects FormData with:
 *  - excelFile: The uploaded Excel file
 *  - subject: email subject
 *  - body: email body (with placeholders like {{Name}})
 *
 * The Excel file must have a header row with "Email".
 * If "document_file" column is found, we'll attach the PDF from Dropbox link.
 */
app.post('/upload-campaign', upload.single('excelFile'), async (req, res) => {
  try {
    console.log('Received /upload-campaign request...');
    const { subject, body } = req.body;
    const fileBuffer = req.file.buffer;

    // Parse the Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      console.log('Excel file is empty or missing data.');
      return res.status(400).json({ message: 'Excel file is empty or missing data.' });
    }

    // Check for "Email" column
    const headerRow = jsonData[0];
    const emailIndex = headerRow.indexOf("Email");
    if (emailIndex === -1) {
      console.log('No "Email" column found.');
      return res.status(400).json({
        message: 'No "Email" column found in the Excel file.'
      });
    }

    // Check for optional "document_file" column
    const certIndex = headerRow.indexOf("document_file");

    // Determine batch
    const lastRecord = await SentMail.findOne().sort({ batch: -1 });
    const currentBatch = lastRecord && lastRecord.batch ? lastRecord.batch + 1 : 1;
    console.log(`Processing batch #${currentBatch}...`);

    // Build array of promises
    const emailPromises = jsonData.slice(1).map(async (row, index) => {
      const email = row[emailIndex];
      if (!email || typeof email !== 'string') return null;

      // Build rowData
      const rowData = {};
      headerRow.forEach((colName, colIdx) => {
        rowData[colName] = (row[colIdx] || '').toString().trim();
      });

      const recipientEmail = rowData["Email"];

      // Check duplicates
      const duplicate = await SentMail.findOne({ recipient: recipientEmail, subject });
      if (duplicate) {
        console.log(`Duplicate found for ${recipientEmail}, skipping.`);
        return {
          recipient: recipientEmail,
          status: 'duplicate',
          batch: currentBatch,
          seq: index + 1
        };
      }

      // Replace placeholders
      const personalizedBody = replacePlaceholders(body, rowData);

      // Build attachments if "document_file" present
      let attachments = [];
      if (certIndex !== -1) {
        const certName = row[certIndex];
        if (certName && typeof certName === 'string' && certName.trim() !== '') {
          // Use Dropbox link to fetch the PDF file
          const dropboxUrl = `https://www.dropbox.com/scl/fi/se9jc3do5s380zipdcs4i/${certName.trim()}?dl=1`;
          const fileBuffer = await downloadFileFromDropbox(dropboxUrl); // Download PDF from Dropbox

          attachments.push({
            filename: certName.trim(),
            content: fileBuffer,
            encoding: 'base64' // Send file as base64 encoding
          });
        }
      }

      // Mail options
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: recipientEmail,
        subject,
        html: personalizedBody,
        attachments
      };

      // Send email
      await retrySend(mailOptions);

      // Create DB record
      const record = await SentMail.create({
        recipient: recipientEmail,
        subject,
        body: personalizedBody,
        batch: currentBatch,
        seq: index + 1
      });

      // Emit to socket.io
      io.emit('newEmail', record);
      console.log(`Sent to ${recipientEmail} successfully, batch #${currentBatch}, seq #${index + 1}`);
      return { recipient: recipientEmail, status: 'sent', batch: currentBatch, seq: index + 1 };
    });

    const results = await Promise.all(emailPromises);
    const statuses = results.filter(r => r !== null);

    console.log(`Campaign processed for batch #${currentBatch}. Returning 200 response...`);
    return res.status(200).json({
      statuses,
      message: `Campaign processed. ${statuses.filter(s => s.status === 'sent').length} emails sent in batch ${currentBatch}.`
    });
  } catch (error) {
    console.error('Error in /upload-campaign:', error);
    return res.status(500).json({
      message: 'Error sending campaign',
      error: error.message
    });
  }
});

// 5) GET /sent-mails - Returns all sent email records sorted by batch and seq in ascending order.
app.get('/sent-mails', async (req, res) => {
  try {
    const mails = await SentMail.find().sort({ batch: 1, seq: 1 });
    return res.json(mails);
  } catch (error) {
    console.error('Error fetching sent mails:', error);
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});