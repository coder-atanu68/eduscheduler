const mongoose = require('mongoose');

const DatasetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Dataset name is required'],
    trim: true,
  },
  rawText: {
    type: String,
    required: true,
  },
  parsed: {
    subjects: [String],
    faculty: [{ name: String, subjects: [String] }],
    classrooms: [{ name: String, capacity: Number }],
    timeslots: { type: Map, of: [String] },
    classes: [{ name: String, strength: Number }],
    lpwOverrides: { type: Map, of: Number },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Dataset', DatasetSchema);
