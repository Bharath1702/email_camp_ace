/***********************
  SERVER (Node/Express with Socket.io)
***********************/
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

const SentMail = require('./models/SentMail');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});

// 1) Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully!'))
.catch((error) => console.error('MongoDB connection error:', error));

// 2) Configure CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// 3) Multer setup: Only one Excel file is uploaded.
const upload = multer({ storage: multer.memoryStorage() });

// 4) Nodemailer transporter (using Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER, // e.g. "your_gmail_username@gmail.com"
    pass: process.env.GMAIL_PASS  // e.g. "your_app_password"
  }
});

/**
 * Helper to replace placeholders in the email body.
 * If the template has "Dear {{NAME}}" and rowData = { NAME: "Alice" }, it returns "Dear Alice".
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
 * Retry helper for temporary SMTP errors (e.g. error code 421)
 */
async function retrySend(mailOptions, retries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      return;
    } catch (error) {
      if (error.responseCode === 421 && attempt < retries) {
        console.warn(`Temporary error sending to ${mailOptions.to}. Retrying attempt ${attempt}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw error;
      }
    }
  }
}

/**
 * POST /upload-campaign
 * Expects FormData with:
 *  - excelFile: The uploaded Excel file
 *  - subject: email subject
 *  - body: email body (HTML with placeholders)
 *
 * The Excel file must have a header row that includes "Email".
 * Optionally, if you want to attach PDFs, you can have a "CertificateFile" column in the Excel,
 * and place matching files in ./certificates/<filename>.
 */
app.post('/upload-campaign', upload.single('excelFile'), async (req, res) => {
  try {
    const { subject, body } = req.body;
    const fileBuffer = req.file.buffer;

    // Parse the Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      return res.status(400).json({ message: 'Excel file is empty or missing data.' });
    }

    // Find index of "Email" column
    const headerRow = jsonData[0];
    const emailIndex = headerRow.indexOf("Email");
    if (emailIndex === -1) {
      return res.status(400).json({
        message: 'No "Email" column found in the Excel file.'
      });
    }

    // (Optional) find index of "CertificateFile" column if you want PDF attachments
    const certIndex = headerRow.indexOf("CertificateFile");

    // Determine current batch by finding the highest batch used so far
    const lastRecord = await SentMail.findOne().sort({ batch: -1 });
    const currentBatch = lastRecord && lastRecord.batch ? lastRecord.batch + 1 : 1;

    // Prepare an array of promises for concurrency
    const emailPromises = jsonData.slice(1).map(async (row, index) => {
      const email = row[emailIndex];
      if (!email || typeof email !== 'string') return null;

      // Build rowData to map each header column to its value
      const rowData = {};
      headerRow.forEach((colName, colIdx) => {
        rowData[colName] = (row[colIdx] || '').toString().trim();
      });

      const recipientEmail = rowData["Email"];

      // Check for duplicates: same recipient and subject
      const duplicate = await SentMail.findOne({ recipient: recipientEmail, subject });
      if (duplicate) {
        return {
          recipient: recipientEmail,
          status: 'duplicate',
          batch: currentBatch,
          seq: index + 1
        };
      }

      // Replace placeholders
      const personalizedBody = replacePlaceholders(body, rowData);

      // Build attachments array if there's a CertificateFile
      let attachments = [];
      if (certIndex !== -1) {
        const certName = row[certIndex];
        if (certName && typeof certName === 'string' && certName.trim() !== '') {
          // e.g. "AliceCertificate.pdf" is placed in ./certificates
          const certPath = path.join(__dirname, 'certificates', certName.trim());
          attachments.push({
            filename: certName.trim(),
            path: certPath
          });
        }
      }

      // Create mailOptions
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: recipientEmail,
        subject,
        html: personalizedBody,
        attachments
      };

      // Send with retry
      await retrySend(mailOptions);

      // Create record
      const record = await SentMail.create({
        recipient: recipientEmail,
        subject,
        body: personalizedBody,
        batch: currentBatch,
        seq: index + 1
      });

      // Emit real-time update
      io.emit('newEmail', record);

      return {
        recipient: recipientEmail,
        status: 'sent',
        batch: currentBatch,
        seq: index + 1
      };
    });

    const results = await Promise.all(emailPromises);
    const statuses = results.filter(r => r !== null);

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

/**
 * GET /sent-mails
 * Returns all sent email records sorted by batch and seq in ascending order.
 */
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
