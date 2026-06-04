const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');

// ── Scheduler Algorithm (mirrored from frontend app.js) ───────────────────────
function generateSchedule(data, lecturesPerWeek, mode = 'balanced') {
  const schedule = {};
  const conflicts = [];

  const allSlots = [];
  for (const [day, slots] of Object.entries(data.timeslots)) {
    for (const slot of slots) allSlots.push({ day, slot });
  }

  for (const cls of data.classes) {
    schedule[cls.name] = {};
    for (const day of Object.keys(data.timeslots)) {
      schedule[cls.name][day] = {};
      for (const slot of data.timeslots[day]) {
        schedule[cls.name][day][slot] = null;
      }
    }
  }

  const requirements = [];
  for (const cls of data.classes) {
    for (const subject of data.subjects) {
      const count = lecturesPerWeek[subject] || 3;
      requirements.push({ class: cls.name, subject, remaining: count });
    }
  }

  shuffle(requirements);

  const facultyBusy = {};
  const roomBusy = {};
  const classBusy = {};

  for (const f of data.faculty) { facultyBusy[f.name] = {}; }
  for (const r of data.classrooms) { roomBusy[r.name] = {}; }
  for (const c of data.classes) { classBusy[c.name] = {}; }

  const initBusy = (obj, day, slot) => {
    if (!obj[day]) obj[day] = {};
    if (!obj[day][slot]) obj[day][slot] = false;
  };

  for (const { day, slot } of allSlots) {
    for (const f of data.faculty) initBusy(facultyBusy[f.name], day, slot);
    for (const r of data.classrooms) initBusy(roomBusy[r.name], day, slot);
    for (const c of data.classes) initBusy(classBusy[c.name], day, slot);
  }

  const maxIterations = mode === 'fast' ? 1 : mode === 'balanced' ? 3 : 6;

  for (let iter = 0; iter < maxIterations; iter++) {
    shuffle(requirements.filter(r => r.remaining > 0));
    for (const req of requirements) {
      if (req.remaining <= 0) continue;

      const capableFaculty = data.faculty.filter(f =>
        f.subjects.some(s => s.toLowerCase() === req.subject.toLowerCase())
      );

      if (!capableFaculty.length) {
        if (iter === 0) conflicts.push({ type: 'no-faculty', class: req.class, subject: req.subject, message: `No faculty available to teach ${req.subject}` });
        req.remaining = 0; continue;
      }

      const shuffledSlots = shuffle([...allSlots]);
      for (const { day, slot } of shuffledSlots) {
        if (req.remaining <= 0) break;
        if (classBusy[req.class][day]?.[slot]) continue;

        if (mode !== 'fast') {
          const prevSlots = (data.timeslots[day] || []);
          const slotIdx = prevSlots.indexOf(slot);
          if (slotIdx > 0) {
            const prevSlot = prevSlots[slotIdx - 1];
            if (schedule[req.class][day][prevSlot]?.subject === req.subject) continue;
          }
        }

        const availFaculty = capableFaculty.filter(f => !facultyBusy[f.name][day]?.[slot]);
        if (!availFaculty.length) continue;

        const cls = data.classes.find(c => c.name === req.class);
        const availRooms = data.classrooms.filter(r => !roomBusy[r.name][day]?.[slot] && r.capacity >= (cls?.strength || 0));
        const fallbackRooms = availRooms.length ? availRooms : data.classrooms.filter(r => !roomBusy[r.name][day]?.[slot]);
        if (!fallbackRooms.length) continue;

        const chosenFaculty = availFaculty[0];
        const chosenRoom = fallbackRooms.sort((a, b) => a.capacity - b.capacity)[0];

        schedule[req.class][day][slot] = { subject: req.subject, faculty: chosenFaculty.name, room: chosenRoom.name };
        facultyBusy[chosenFaculty.name][day][slot] = true;
        roomBusy[chosenRoom.name][day][slot] = true;
        classBusy[req.class][day][slot] = true;
        req.remaining--;
      }

      if (req.remaining > 0) {
        conflicts.push({ type: 'unscheduled', class: req.class, subject: req.subject, count: req.remaining, message: `Could not schedule ${req.remaining} lecture(s) of ${req.subject} for ${req.class}` });
        req.remaining = 0;
      }
    }
  }

  // Build reverse lookups
  const byFaculty = {};
  const byRoom = {};
  for (const [cls, days_] of Object.entries(schedule)) {
    for (const [day, slots] of Object.entries(days_)) {
      for (const [slot, entry] of Object.entries(slots)) {
        if (!entry) continue;
        if (!byFaculty[entry.faculty]) byFaculty[entry.faculty] = {};
        if (!byFaculty[entry.faculty][day]) byFaculty[entry.faculty][day] = {};
        byFaculty[entry.faculty][day][slot] = { ...entry, class: cls };

        if (!byRoom[entry.room]) byRoom[entry.room] = {};
        if (!byRoom[entry.room][day]) byRoom[entry.room][day] = {};
        byRoom[entry.room][day][slot] = { ...entry, class: cls };
      }
    }
  }

  const seen = new Set();
  const dedupedConflicts = conflicts.filter(c => {
    const key = `${c.type}-${c.class}-${c.subject}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  return { byClass: schedule, byFaculty, byRoom, conflicts: dedupedConflicts };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Strip null slots from byClass before saving to MongoDB
// Null values in nested Mongoose Maps cause save failures
function stripNullSlots(byClass) {
  const clean = {};
  for (const [cls, days] of Object.entries(byClass)) {
    clean[cls] = {};
    for (const [day, slots] of Object.entries(days)) {
      clean[cls][day] = {};
      for (const [slot, entry] of Object.entries(slots)) {
        if (entry !== null && entry !== undefined) {
          clean[cls][day][slot] = entry;
        }
      }
    }
  }
  return clean;
}

// ─────────────────────────────────────────────────────────────────────────────

// POST /api/schedules/generate — Generate and save a schedule
router.post('/generate', async (req, res) => {
  try {
    const { name, parsedData, lecturesPerWeek, algorithmMode, datasetId } = req.body;

    if (!name || !parsedData) {
      return res.status(400).json({ success: false, message: 'name and parsedData are required' });
    }

    const result = generateSchedule(parsedData, lecturesPerWeek || {}, algorithmMode || 'balanced');

    // Compute stats
    let totalAssigned = 0, totalPossible = 0;
    const classes = parsedData.classes.map(c => c.name);
    for (const cls of classes) {
      for (const daySlots of Object.values(result.byClass[cls] || {})) {
        for (const entry of Object.values(daySlots)) {
          if (entry) totalAssigned++;
        }
      }
    }
    for (const count of Object.values(lecturesPerWeek || {})) {
      totalPossible += count * classes.length;
    }
    const efficiency = totalPossible > 0 ? Math.round((totalAssigned / totalPossible) * 100) : 0;

    // Strip null slots before saving — Mongoose nested Maps reject null values
    const cleanByClass = stripNullSlots(result.byClass);

    const schedule = await Schedule.create({
      name,
      datasetId: datasetId || null,
      algorithmMode: algorithmMode || 'balanced',
      lecturesPerWeek,
      byClass: cleanByClass,
      byFaculty: result.byFaculty,
      byRoom: result.byRoom,
      conflicts: result.conflicts,
      stats: { totalAssigned, totalPossible, conflictCount: result.conflicts.length, efficiency },
    });

    res.status(201).json({ success: true, data: schedule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/schedules — List all schedules
router.get('/', async (req, res) => {
  try {
    const schedules = await Schedule.find()
      .select('name algorithmMode stats createdAt datasetId')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: schedules.length, data: schedules });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/schedules/:id — Get full schedule
router.get('/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found' });
    res.json({ success: true, data: schedule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/schedules/:id — Delete a schedule
router.delete('/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found' });
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
