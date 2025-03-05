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

const SentMail = require('./models/SentMail');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully!'))
.catch((error) => console.error('MongoDB connection error:', error));

// Configure CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Multer setup: Only one Excel file is uploaded.
const upload = multer({ storage: multer.memoryStorage() });

// Nodemailer transporter (using Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,  // e.g. "your_gmail_username@gmail.com"
    pass: process.env.GMAIL_PASS   // e.g. "your_app_password"
  }
});

/**
 * Helper to replace placeholders in the email body.
 * For example, if the template contains "Dear {{NAME}}"
 * and rowData = { NAME: "Alice", AMOUNT: "500" },
 * it returns "Dear Alice".
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
 *  - excelFile: the uploaded Excel file
 *  - subject: email subject
 *  - body: email body (HTML with placeholders)
 *
 * This endpoint:
 *  1. Parses the Excel file (which must include a header row with "Email").
 *  2. Determines the current batch number (incrementing from the previous batch).
 *  3. For each data row, it assigns a sequence number and sends the email.
 *  4. Stores each record with its batch and seq values.
 *  5. Emits a socket.io event for real-time updates.
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

    // Header row must contain "Email"
    const headerRow = jsonData[0];
    const emailIndex = headerRow.indexOf("Email");
    if (emailIndex === -1) {
      return res.status(400).json({
        message: 'No "Email" column found. Please ensure the header row includes "Email".'
      });
    }

    // Determine current batch number by finding the highest batch value in SentMail
    const lastRecord = await SentMail.findOne().sort({ batch: -1 });
    const currentBatch = lastRecord && lastRecord.batch ? lastRecord.batch + 1 : 1;

    // Process each data row and assign a sequence number
    const emailPromises = jsonData.slice(1).map(async (row, index) => {
      const email = row[emailIndex];
      if (!email || typeof email !== 'string') return null;

      // Build a rowData object mapping header columns to cell values
      const rowData = {};
      headerRow.forEach((col, idx) => {
        rowData[col] = (row[idx] || '').toString().trim();
      });
      const recipientEmail = rowData["Email"];

      // Check for duplicate: same recipient and subject
      const duplicate = await SentMail.findOne({ recipient: recipientEmail, subject });
      if (duplicate) return { recipient: recipientEmail, status: 'duplicate', batch: currentBatch, seq: index + 1 };

      // Replace placeholders in the email body template
      const personalizedBody = replacePlaceholders(body, rowData);

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: recipientEmail,
        subject,
        html: personalizedBody
      };

      // Send email with retry logic
      await retrySend(mailOptions);

      // Save the sent email record with batch and sequence number
      const record = await SentMail.create({
        recipient: recipientEmail,
        subject,
        body: personalizedBody,
        batch: currentBatch,
        seq: index + 1
      });

      // Emit real-time update via socket.io
      io.emit('newEmail', record);
      return { recipient: recipientEmail, status: 'sent', batch: currentBatch, seq: index + 1 };
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
 * Returns all sent email records sorted by batch and sequence in ascending order.
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
