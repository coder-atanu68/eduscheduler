const express = require('express');
const router = express.Router();
const Dataset = require('../models/Dataset');

// ── Parse raw .txt text (same logic as frontend) ──────────────────────────────
function parseDataset(text) {
  const sections = {};
  let currentSection = null;
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

  for (const line of lines) {
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) { currentSection = sectionMatch[1].trim().toUpperCase(); sections[currentSection] = []; continue; }
    if (currentSection) sections[currentSection].push(line);
  }

  const subjects = (sections['SUBJECTS'] || []).map(s => s.trim()).filter(Boolean);
  const faculty = (sections['FACULTY'] || []).map(line => {
    const [name, subjectsRaw] = line.split('|').map(s => s.trim());
    return { name, subjects: subjectsRaw ? subjectsRaw.split(',').map(s => s.trim()) : [] };
  }).filter(f => f.name);

  const classrooms = (sections['CLASSROOMS'] || []).map(line => {
    const parts = line.split('|').map(s => s.trim());
    return { name: parts[0], capacity: parseInt(parts[1]) || 40 };
  }).filter(c => c.name);

  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const timeslots = {};
  for (const line of (sections['TIMESLOTS'] || [])) {
    const [dayRaw, slotsRaw] = line.split('|').map(s => s.trim());
    const day = days.find(d => d.toLowerCase() === dayRaw.toLowerCase()) || dayRaw;
    if (slotsRaw) timeslots[day] = slotsRaw.split(',').map(s => s.trim()).filter(Boolean);
  }

  const classes = (sections['CLASSES'] || []).map(line => {
    const parts = line.split('|').map(s => s.trim());
    return { name: parts[0], strength: parseInt(parts[1]) || 35 };
  }).filter(c => c.name);

  const lpwOverrides = {};
  for (const line of (sections['LECTURES_PER_WEEK'] || [])) {
    const [subj, count] = line.split('|').map(s => s.trim());
    if (subj && count) lpwOverrides[subj] = parseInt(count) || 3;
  }

  return { subjects, faculty, classrooms, timeslots, classes, lpwOverrides };
}

// POST /api/datasets — Upload & save a dataset
router.post('/', async (req, res) => {
  try {
    const { name, rawText } = req.body;
    if (!name || !rawText) return res.status(400).json({ success: false, message: 'name and rawText are required' });

    const parsed = parseDataset(rawText);
    if (!parsed.subjects.length) return res.status(400).json({ success: false, message: 'No subjects found in dataset' });

    const dataset = await Dataset.create({ name, rawText, parsed });
    res.status(201).json({ success: true, data: dataset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/datasets — List all datasets
router.get('/', async (req, res) => {
  try {
    const datasets = await Dataset.find().select('name createdAt parsed.subjects parsed.classes').sort({ createdAt: -1 });
    res.json({ success: true, count: datasets.length, data: datasets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/datasets/:id — Get single dataset
router.get('/:id', async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) return res.status(404).json({ success: false, message: 'Dataset not found' });
    res.json({ success: true, data: dataset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/datasets/:id — Delete a dataset
router.delete('/:id', async (req, res) => {
  try {
    const dataset = await Dataset.findByIdAndDelete(req.params.id);
    if (!dataset) return res.status(404).json({ success: false, message: 'Dataset not found' });
    res.json({ success: true, message: 'Dataset deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
