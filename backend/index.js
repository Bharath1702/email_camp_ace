/***********************
  SERVER (Node/Express)
***********************/
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const multer = require('multer');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// 1) Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully!'))
.catch((error) => console.error('MongoDB connection error:', error));

// 2) Import the SentMail model
const SentMail = require('./models/SentMail');

// 3) Configure CORS
const corsOptions = {
  origin: 'https://email-camp-ace.vercel.app' , // or your production front-end URL|| 'http://localhost:3000'
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};
app.use(cors(corsOptions));

// Multer setup: store uploaded file in memory
const upload = multer({ storage: multer.memoryStorage() });

// Nodemailer transporter (using Gmail + App Password)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,  // e.g. "your_gmail_username@gmail.com"
    pass: process.env.GMAIL_PASS   // e.g. "abcd efgh ijkl mnop"
  }
});

/** 
 * Helper to replace placeholders in the template 
 * e.g. if body has "Dear {{NAME}}", rowData = {NAME: "Alice"} => "Dear Alice"
 */
function replacePlaceholders(template, rowData) {
  let output = template;
  for (const key of Object.keys(rowData)) {
    const placeholder = `{{${key}}}`;
    // Use global regex so multiple occurrences are replaced
    const regex = new RegExp(placeholder, 'g');
    output = output.replace(regex, rowData[key] || '');
  }
  return output;
}

/** 
 * Helper to chunk an array into smaller arrays 
 * e.g. chunkArray([1,2,3,4,5], 2) => [[1,2],[3,4],[5]]
 */
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * POST /upload-campaign
 * formData: { excelFile, subject, body }
 *  - excelFile: the original Excel
 *  - subject: email subject
 *  - body: email body (with placeholders)
 */
app.post('/upload-campaign', upload.single('excelFile'), async (req, res) => {
  try {
    const { subject, body } = req.body;
    const fileBuffer = req.file.buffer;

    // Parse Excel
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      return res.status(400).json({ message: 'Excel file is empty or missing data.' });
    }

    // Identify columns
    const headerRow = jsonData[0];
    const emailIndex = headerRow.indexOf("Email");
    if (emailIndex === -1) {
      return res.status(400).json({
        message: 'No "Email" column found. Please ensure header row has "Email".'
      });
    }

    // Build an array of row objects
    const rowsData = [];
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length === 0) continue;

      const email = row[emailIndex];
      if (!email || typeof email !== 'string') continue; // skip invalid emails

      // Create a rowData object with key=headerRow[col], value=row[col]
      const rowData = {};
      for (let col = 0; col < headerRow.length; col++) {
        const key = headerRow[col];
        rowData[key] = (row[col] || '').toString().trim();
      }
      rowsData.push(rowData);
    }

    // Chunk the rows to avoid timeouts
    const chunkSize = 10; // send 10 emails at a time
    const chunks = chunkArray(rowsData, chunkSize);

    let totalSent = 0;

    // Send each chunk sequentially
    for (const chunk of chunks) {
      for (const rowData of chunk) {
        const recipientEmail = rowData["Email"];
        // Replace placeholders
        const personalizedBody = replacePlaceholders(body, rowData);

        // Send mail
        await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: recipientEmail,
          subject: subject,
          html: personalizedBody
        });

        // Store the final (personalized) email in DB
        await SentMail.create({
          recipient: recipientEmail,
          subject: subject,
          body: personalizedBody
        });

        totalSent++;
      }
      // Optional: short delay between chunks (if necessary)
      // await new Promise(r => setTimeout(r, 2000));
    }

    return res.status(200).json({
      message: `Campaign sent to ${totalSent} recipients.`
    });
  } catch (error) {
    console.error('Error in /upload-campaign:', error);
    return res.status(500).json({
      message: 'Error sending campaign',
      error: error.message
    });
  }
});

/** GET /sent-mails => returns all sent mails */
app.get('/sent-mails', async (req, res) => {
  try {
    const mails = await SentMail.find().sort({ sentAt: -1 });
    return res.json(mails);
  } catch (error) {
    console.error('Error fetching sent mails:', error);
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
