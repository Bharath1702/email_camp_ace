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

// 3) Configure CORS (allow only the domain in FRONTEND_URL)
const corsOptions = {
  origin: process.env.FRONTEND_URL, // e.g. "http://localhost:3000"
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
 * Helper to replace placeholders in the email body.
 * E.g., if the body has "Dear {{NAME}}",
 * and rowData = { NAME: "Alice", AMOUNT: "500" },
 * we replace "{{NAME}}" with "Alice", etc.
 */
function replacePlaceholders(template, rowData) {
  let output = template;
  for (const key of Object.keys(rowData)) {
    const placeholder = `{{${key}}}`;
    // Use a global regex so multiple occurrences are replaced
    const regex = new RegExp(placeholder, 'g');
    output = output.replace(regex, rowData[key] || '');
  }
  return output;
}

/**
 * Endpoint to handle file upload + sending the email campaign
 * POST /upload-campaign
 * Body (formData):
 *  - excelFile (the Excel file)
 *  - subject (string)
 *  - body (string or HTML) with placeholders like {{NAME}}
 */
app.post('/upload-campaign', upload.single('excelFile'), async (req, res) => {
  try {
    // Extract subject & body from the form fields
    const { subject, body } = req.body;

    // The uploaded Excel file (in memory)
    const fileBuffer = req.file.buffer;

    // Parse the file with SheetJS
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; // Use the first sheet
    const worksheet = workbook.Sheets[sheetName];

    // Convert the sheet to JSON row-by-row (array of arrays), with the 1st row as header
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Check if there's at least one header row + data
    if (jsonData.length < 2) {
      return res.status(400).json({
        message: 'Excel file is empty or missing data.'
      });
    }

    // The first row is the header (e.g., ["Email", "NAME", "AMOUNT", "GIFT_CODE", ...])
    const headerRow = jsonData[0];
    // Find the index of the "Email" column
    const emailIndex = headerRow.indexOf("Email");
    if (emailIndex === -1) {
      return res.status(400).json({
        message: 'No "Email" column found in the Excel file. Please ensure you have a header row with "Email".'
      });
    }

    // We'll store how many emails were actually sent
    let sentCount = 0;

    // Process each subsequent row
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      // e.g. row might be ["alice@example.com", "Alice", "500", "ABCD-1234-XXXX"]

      // If this row doesn't have a valid email in the emailIndex column, skip
      const email = row[emailIndex];
      if (!email || typeof email !== 'string') {
        continue;
      }

      // Build an object that maps columnName -> rowValue
      // e.g. if headerRow = ["Email","NAME","AMOUNT"]
      // and row = ["alice@example.com", "Alice", "500"]
      // then rowData = { Email:"alice@example.com", NAME:"Alice", AMOUNT:"500" }
      const rowData = {};
      for (let col = 0; col < headerRow.length; col++) {
        const columnName = headerRow[col];
        const cellValue = row[col] || '';
        rowData[columnName] = cellValue.toString().trim();
      }

      // Replace placeholders in the body with rowData
      const personalizedBody = replacePlaceholders(body, rowData);

      // Create the mail options
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email.trim(),
        subject: subject,
        // If your body is HTML with tags + placeholders, we do `html: personalizedBody`
        // If just text, or you prefer HTML anyway, it's up to you. We'll assume HTML here:
        html: personalizedBody
      };

      // Send the email
      await transporter.sendMail(mailOptions);

      // Store the final (personalized) email data in MongoDB
      await SentMail.create({
        recipient: email.trim(),
        subject: subject,
        body: personalizedBody
        // sentAt defaults to Date.now per the schema
      });

      sentCount++;
    }

    return res.status(200).json({
      message: `Campaign sent to ${sentCount} recipients.`
    });
  } catch (error) {
    console.error('Error in /upload-campaign:', error);
    return res.status(500).json({
      message: 'Error sending campaign',
      error: error.message
    });
  }
});

// Start the Express server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
