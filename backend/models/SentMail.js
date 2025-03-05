const mongoose = require('mongoose');

const SentMailSchema = new mongoose.Schema({
  recipient: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  order: { type: Number },   // Stores the Excel row index (or serial number)
  sentAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SentMail', SentMailSchema);
