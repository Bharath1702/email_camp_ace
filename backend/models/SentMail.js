const mongoose = require('mongoose');

const SentMailSchema = new mongoose.Schema({
  recipient: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SentMail', SentMailSchema);
