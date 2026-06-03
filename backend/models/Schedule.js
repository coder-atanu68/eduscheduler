const mongoose = require('mongoose');

const LessonSchema = new mongoose.Schema({
  subject: String,
  faculty: String,
  room: String,
  class: String,
}, { _id: false });

const ScheduleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Schedule name is required'],
    trim: true,
  },
  datasetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dataset',
    default: null,
  },
  algorithmMode: {
    type: String,
    enum: ['fast', 'balanced', 'thorough'],
    default: 'balanced',
  },
  lecturesPerWeek: {
    type: Map,
    of: Number,
  },
  // byClass: { "Class 10-A": { "Monday": { "09:00-10:00": { subject, faculty, room } } } }
  byClass: {
    type: Map,
    of: {
      type: Map,
      of: {
        type: Map,
        of: LessonSchema,
      },
    },
  },
  // byFaculty: similar structure
  byFaculty: {
    type: Map,
    of: {
      type: Map,
      of: {
        type: Map,
        of: {
          subject: String,
          faculty: String,
          room: String,
          class: String,
        },
      },
    },
  },
  // byRoom: similar structure
  byRoom: {
    type: Map,
    of: {
      type: Map,
      of: {
        type: Map,
        of: {
          subject: String,
          faculty: String,
          room: String,
          class: String,
        },
      },
    },
  },
  conflicts: [
    {
      type: { type: String },
      class: String,
      subject: String,
      count: Number,
      message: String,
    }
  ],
  stats: {
    totalAssigned: Number,
    totalPossible: Number,
    conflictCount: Number,
    efficiency: Number,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Schedule', ScheduleSchema);
