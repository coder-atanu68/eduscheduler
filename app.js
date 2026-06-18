/**
 * TIMETABLE SCHEDULER — Frontend Application Logic
 * DAA Mini Project | Algorithm: Graph Coloring (Welsh-Powell)
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// API CONFIG
// ═══════════════════════════════════════════════════════════════
// In production this will be the Render URL (set automatically via window.location)
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : '/api';

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
const State = {
  rawData: null,
  parsed: null,
  schedule: null,
  conflicts: [],
  lecturesPerWeek: {},
  currentTab: 'class',
  currentEntity: null,
  savedDatasetId: null,
};

// ═══════════════════════════════════════════════════════════════
// PARSER
// ═══════════════════════════════════════════════════════════════
const Parser = {
  parse(text) {
    const sections = {};
    let currentSection = null;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

    for (const line of lines) {
      const sectionMatch = line.match(/^\[(.+)\]$/);
      if (sectionMatch) { currentSection = sectionMatch[1].trim().toUpperCase(); sections[currentSection] = []; continue; }
      if (currentSection) sections[currentSection].push(line);
    }

    // Parse subjects
    const subjects = (sections['SUBJECTS'] || []).map(s => s.trim()).filter(Boolean);

    // Parse faculty: "Name | Subject1, Subject2"
    const faculty = (sections['FACULTY'] || []).map(line => {
      const [name, subjectsRaw] = line.split('|').map(s => s.trim());
      return { name, subjects: subjectsRaw ? subjectsRaw.split(',').map(s => s.trim()) : [] };
    }).filter(f => f.name);

    // Parse classrooms: "Name | Capacity"
    const classrooms = (sections['CLASSROOMS'] || []).map(line => {
      const parts = line.split('|').map(s => s.trim());
      return { name: parts[0], capacity: parseInt(parts[1]) || 40 };
    }).filter(c => c.name);

    // Parse time slots: "Day | slot1, slot2, ..."
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const timeslots = {};
    for (const line of (sections['TIMESLOTS'] || [])) {
      const [dayRaw, slotsRaw] = line.split('|').map(s => s.trim());
      const day = days.find(d => d.toLowerCase() === dayRaw.toLowerCase()) || dayRaw;
      if (slotsRaw) {
        timeslots[day] = slotsRaw.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    // Parse classes: "Name | Strength"
    const classes = (sections['CLASSES'] || []).map(line => {
      const parts = line.split('|').map(s => s.trim());
      return { name: parts[0], strength: parseInt(parts[1]) || 35 };
    }).filter(c => c.name);

    // Parse lectures per week overrides
    const lpwOverrides = {};
    for (const line of (sections['LECTURES_PER_WEEK'] || [])) {
      const [subj, count] = line.split('|').map(s => s.trim());
      if (subj && count) lpwOverrides[subj] = parseInt(count) || 3;
    }

    return { subjects, faculty, classrooms, timeslots, classes, lpwOverrides };
  },

  validate(data) {
    const errors = [];
    if (!data.subjects.length) errors.push('No subjects found. Add a [SUBJECTS] section.');
    if (!data.faculty.length) errors.push('No faculty found. Add a [FACULTY] section.');
    if (!data.classrooms.length) errors.push('No classrooms found. Add a [CLASSROOMS] section.');
    if (!Object.keys(data.timeslots).length) errors.push('No time slots found. Add a [TIMESLOTS] section.');
    if (!data.classes.length) errors.push('No classes found. Add a [CLASSES] section.');
    return errors;
  }
};

// ═══════════════════════════════════════════════════════════════
// NOTE: Scheduling algorithm has been moved to Python backend
// (python_backend/scheduler.py — Backtracking + MRV)
// The frontend calls POST /api/schedules/generate to run it.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// SUBJECT COLOR MAP
// ═══════════════════════════════════════════════════════════════
const SubjectColors = (() => {
  const palette = [
    { bg: 'rgba(108,99,255,0.25)', border: '#6c63ff', text: '#c4c0ff' },
    { bg: 'rgba(0,212,170,0.2)',   border: '#00d4aa', text: '#00ffd1' },
    { bg: 'rgba(255,92,135,0.2)',  border: '#ff5c87', text: '#ffaac0' },
    { bg: 'rgba(255,179,71,0.2)',  border: '#ffb347', text: '#ffd49f' },
    { bg: 'rgba(56,189,248,0.2)',  border: '#38bdf8', text: '#93e0ff' },
    { bg: 'rgba(167,139,250,0.2)', border: '#a78bfa', text: '#d0bcff' },
    { bg: 'rgba(251,113,133,0.2)', border: '#fb7185', text: '#ffc2cb' },
    { bg: 'rgba(52,211,153,0.2)',  border: '#34d399', text: '#a7f3d0' },
    { bg: 'rgba(245,158,11,0.2)',  border: '#f59e0b', text: '#fde68a' },
    { bg: 'rgba(96,165,250,0.2)',  border: '#60a5fa', text: '#bfdbfe' },
  ];
  const map = {};
  let idx = 0;
  return {
    get(subject) {
      if (!map[subject]) { map[subject] = palette[idx % palette.length]; idx++; }
      return map[subject];
    },
    reset() { Object.keys(map).forEach(k => delete map[k]); idx = 0; }
  };
})();

// ═══════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.querySelector('.toast-msg').textContent = msg;
  el.querySelector('.toast-icon').textContent = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove('show'), 3500);
}

function setProgress(pct, label) {
  document.querySelector('.progress-fill').style.width = pct + '%';
  document.querySelector('.progress-label span:last-child').textContent = label;
}

function showSection(id) {
  document.getElementById(id).style.display = 'block';
  document.getElementById(id).classList.add('animate-in');
}

function hideSection(id) {
  document.getElementById(id).style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════
const Render = {
  parsedPreview(data) {
    // Subjects
    document.getElementById('preview-subjects').innerHTML =
      data.subjects.map(s => `<span class="chip">${s}</span>`).join('');

    // Faculty
    document.getElementById('preview-faculty').innerHTML =
      data.faculty.map(f => `<span class="chip">${f.name}</span>`).join('');

    // Classrooms
    document.getElementById('preview-rooms').innerHTML =
      data.classrooms.map(r => `<span class="chip">${r.name} (${r.capacity})</span>`).join('');

    // Days & slots
    const days = Object.keys(data.timeslots);
    document.getElementById('preview-slots').innerHTML =
      days.map(d => `<span class="chip accent">${d}: ${data.timeslots[d].length} slots</span>`).join('');

    // Classes
    document.getElementById('preview-classes').innerHTML =
      data.classes.map(c => `<span class="chip">${c.name} (${c.strength})</span>`).join('');
  },

  lecturesTable(subjects, overrides) {
    const tbody = document.getElementById('lpw-tbody');
    tbody.innerHTML = subjects.map(s => `
      <tr>
        <td>${s}</td>
        <td><input type="number" id="lpw-${s.replace(/\s+/g,'-')}" min="1" max="10"
          value="${overrides[s] || 3}" /></td>
      </tr>
    `).join('');
  },

  legend(subjects) {
    const legend = document.getElementById('subject-legend');
    legend.innerHTML = subjects.map(s => {
      const c = SubjectColors.get(s);
      return `<span class="legend-item"><span class="legend-dot" style="background:${c.border}"></span>${s}</span>`;
    }).join('');
  },

  timetableByClass(className) {
    const classSchedule = State.schedule.byClass[className];
    const g1Schedule = State.schedule.byClass[`${className} [G1]`];
    const g2Schedule = State.schedule.byClass[`${className} [G2]`];
    const data = State.parsed;
    if (!classSchedule) return '<div class="empty-state"><div class="icon">📭</div><p>No data</p></div>';

    // If lab groups exist, render a merged view with Group 1/2 sub-rows
    if (g1Schedule || g2Schedule) {
      return this._renderGroupedGrid(classSchedule, g1Schedule, g2Schedule, data);
    }
    return this._renderGrid(classSchedule, data);
  },

  timetableByFaculty(facultyName) {
    const sched = State.schedule.byFaculty[facultyName];
    const data = State.parsed;
    if (!sched) return '<div class="empty-state"><div class="icon">📭</div><p>No data for this faculty member yet.</p></div>';
    return this._renderGrid(sched, data, true);
  },

  timetableByRoom(roomName) {
    const sched = State.schedule.byRoom[roomName];
    const data = State.parsed;
    if (!sched) return '<div class="empty-state"><div class="icon">📭</div><p>No data for this room yet.</p></div>';
    return this._renderGrid(sched, data, false, true);
  },

  _renderGrid(sched, data, showClass = false, showClass2 = false) {
    const days = Object.keys(data.timeslots);
    // Collect all unique slots
    const allUniqueSlots = [...new Set(days.flatMap(d => data.timeslots[d]))];

    const colCount = days.length + 1;
    const colTemplate = `120px repeat(${days.length}, 1fr)`;

    let html = `<div class="timetable-container"><div class="timetable-grid">`;

    // Header
    html += `<div class="timetable-header-row" style="grid-template-columns:${colTemplate}">`;
    html += `<div class="cell-time">TIME</div>`;
    for (const day of days) html += `<div class="cell-day-header">${day}</div>`;
    html += `</div>`;

    // Rows
    for (const slot of allUniqueSlots) {
      html += `<div class="timetable-row" style="grid-template-columns:${colTemplate}">`;
      html += `<div class="cell-time" style="font-family:'JetBrains Mono',monospace;font-size:0.68rem;">${slot}</div>`;

      for (const day of days) {
        const entry = sched[day]?.[slot];
        html += `<div class="cell">`;
        if (entry) {
          const c = SubjectColors.get(entry.subject);
          const label = showClass ? (entry.class || '') : showClass2 ? (entry.class || '') : (entry.faculty || '');
          const room  = showClass || showClass2 ? entry.room : entry.room;
          html += `<div class="lesson-card" style="background:${c.bg};border-color:${c.border};color:${c.text}" title="${entry.subject} — ${entry.faculty} — ${entry.room}">
            <div class="lesson-subject">${entry.subject}</div>
            <div class="lesson-faculty">${label}</div>
            <div class="lesson-room">📍 ${room}</div>
          </div>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }

    html += `</div></div>`;
    return html;
  },

  _renderGroupedGrid(mainSched, g1Sched, g2Sched, data) {
    const days = Object.keys(data.timeslots);
    const allUniqueSlots = [...new Set(days.flatMap(d => data.timeslots[d]))];
    const colTemplate = `120px 44px repeat(${days.length}, 1fr)`;

    let html = `<div class="timetable-container"><div class="timetable-grid">`;

    // Header
    html += `<div class="timetable-header-row" style="grid-template-columns:${colTemplate}">`;
    html += `<div class="cell-time">TIME</div>`;
    html += `<div class="cell-time" style="font-size:0.55rem;letter-spacing:0.05em;">GRP</div>`;
    for (const day of days) html += `<div class="cell-day-header">${day}</div>`;
    html += `</div>`;

    for (const slot of allUniqueSlots) {
      // ── Group 1 row ──
      html += `<div class="timetable-row" style="grid-template-columns:${colTemplate}">`;
      html += `<div class="cell-time" style="font-family:'JetBrains Mono',monospace;font-size:0.68rem;">${slot}</div>`;
      html += `<div class="cell" style="display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;opacity:0.5;">1</div>`;

      for (const day of days) {
        const mainEntry = mainSched[day]?.[slot];
        const g1Entry = g1Sched?.[day]?.[slot];
        const entry = mainEntry || g1Entry;
        html += `<div class="cell">`;
        if (entry) {
          const c = SubjectColors.get(entry.subject);
          html += `<div class="lesson-card" style="background:${c.bg};border-color:${c.border};color:${c.text}" title="${entry.subject} — ${entry.faculty} — ${entry.room}">
            <div class="lesson-subject">${entry.subject}</div>
            <div class="lesson-faculty">${entry.faculty}</div>
            <div class="lesson-room">📍 ${entry.room}</div>
          </div>`;
        }
        html += `</div>`;
      }
      html += `</div>`;

      // ── Group 2 row ──
      html += `<div class="timetable-row" style="grid-template-columns:${colTemplate};margin-bottom:2px;">`;
      html += `<div class="cell-time" style="font-size:0;padding:0;min-height:0;border-top:none;"></div>`;
      html += `<div class="cell" style="display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;opacity:0.5;">2</div>`;

      for (const day of days) {
        const mainEntry = mainSched[day]?.[slot];
        const g2Entry = g2Sched?.[day]?.[slot];
        const entry = mainEntry || g2Entry;
        html += `<div class="cell">`;
        if (entry) {
          const c = SubjectColors.get(entry.subject);
          html += `<div class="lesson-card" style="background:${c.bg};border-color:${c.border};color:${c.text}" title="${entry.subject} — ${entry.faculty} — ${entry.room}">
            <div class="lesson-subject">${entry.subject}</div>
            <div class="lesson-faculty">${entry.faculty}</div>
            <div class="lesson-room">📍 ${entry.room}</div>
          </div>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }

    html += `</div></div>`;
    return html;
  },

  stats(schedule, data) {
    let totalAssigned = 0;
    let totalPossible = 0;

    // Count ALL entries in byClass — including lab groups like "CS Sem 4-A [G1]"
    for (const cls of Object.keys(schedule.byClass)) {
      const days = Object.keys(schedule.byClass[cls] || {});
      for (const day of days) {
        for (const slot of Object.values(schedule.byClass[cls][day])) {
          if (slot) totalAssigned++;
        }
      }
    }

    // Calculate total possible — lab subjects (ending with "Lab") are doubled
    // because each class splits into 2 groups
    const numClasses = data.classes.length;
    for (const [subj, count] of Object.entries(State.lecturesPerWeek)) {
      const isLab = subj.trim().endsWith('Lab');
      totalPossible += count * numClasses * (isLab ? 2 : 1);
    }

    const conflictCount = schedule.conflicts.length;
    const efficiency = totalPossible > 0 ? Math.round((totalAssigned / totalPossible) * 100) : 0;

    document.getElementById('stat-assigned').textContent = totalAssigned;
    document.getElementById('stat-possible').textContent = totalPossible;
    document.getElementById('stat-conflicts').textContent = conflictCount;
    document.getElementById('stat-efficiency').textContent = efficiency + '%';

    // Color coding
    document.getElementById('stat-conflicts-card').className = `stat-card ${conflictCount === 0 ? 'good' : conflictCount < 5 ? 'warn' : 'error'}`;
    document.getElementById('stat-efficiency-card').className = `stat-card ${efficiency >= 90 ? 'good' : efficiency >= 70 ? 'warn' : 'info'}`;
  },

  conflicts(conflicts) {
    const panel = document.getElementById('conflicts-list');
    if (!conflicts.length) {
      panel.innerHTML = `<div class="no-conflicts"><div class="icon">✅</div><p>No scheduling conflicts detected! All lectures successfully placed.</p></div>`;
      return;
    }
    panel.innerHTML = conflicts.map(c => `
      <div class="conflict-item">
        <div class="conflict-icon">⚠️</div>
        <div class="conflict-text">${c.message}</div>
      </div>
    `).join('');
  },

  selectorOptions(entities, selectId) {
    const sel = document.getElementById(selectId);
    sel.innerHTML = entities.map(e => `<option value="${e}">${e}</option>`).join('');
  }
};

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════
function exportCSV() {
  if (!State.schedule || !State.parsed) return;
  const data = State.parsed;
  const rows = [['Class', 'Day', 'Time Slot', 'Subject', 'Faculty', 'Room']];

  for (const [cls, days] of Object.entries(State.schedule.byClass)) {
    for (const [day, slots] of Object.entries(days)) {
      for (const [slot, entry] of Object.entries(slots)) {
        if (entry) rows.push([cls, day, slot, entry.subject, entry.faculty, entry.room]);
      }
    }
  }

  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'timetable.csv'; a.click();
  URL.revokeObjectURL(url);
  toast('Timetable exported as CSV!');
}

// ═══════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════
function handleFileLoad(text, filename) {
  try {
    State.parsed = Parser.parse(text);
    const errors = Parser.validate(State.parsed);
    if (errors.length) { toast(errors[0], 'error'); return; }

    // Merge LPW from file
    State.lecturesPerWeek = {};
    for (const s of State.parsed.subjects) {
      State.lecturesPerWeek[s] = State.parsed.lpwOverrides[s] || 3;
    }

    SubjectColors.reset();

    Render.parsedPreview(State.parsed);
    Render.lecturesTable(State.parsed.subjects, State.lecturesPerWeek);

    // Update slot summary
    const totalSlots = Object.values(State.parsed.timeslots).reduce((a, b) => a + b.length, 0);
    const slotSummaryEl = document.getElementById('slot-summary');
    if (slotSummaryEl) slotSummaryEl.value = `${totalSlots} slots × ${State.parsed.classes.length} classes`;

    showSection('config-section');
    showSection('generate-section');
    hideSection('results-section');

    toast(`✓ Loaded "${filename}" — ${State.parsed.subjects.length} subjects, ${State.parsed.faculty.length} faculty, ${State.parsed.classes.length} classes`);
    document.getElementById('config-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    toast('Failed to parse file: ' + e.message, 'error');
  }
}

async function generateTimetable() {
  if (!State.parsed) { toast('Please load a dataset first.', 'error'); return; }

  // Gather LPW values
  for (const s of State.parsed.subjects) {
    const id = `lpw-${s.replace(/\s+/g,'-')}`;
    const el = document.getElementById(id);
    if (el) State.lecturesPerWeek[s] = parseInt(el.value) || 3;
  }

  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Generating...`;

  // Animate progress
  const steps = [
    [15, 'Sending to Python backend...'],
    [35, 'Running Backtracking + MRV...'],
    [55, 'Applying constraints...'],
    [75, 'Optimizing schedule...'],
    [90, 'Saving to database...'],
  ];
  let stepIdx = 0;
  const progressInterval = setInterval(() => {
    if (stepIdx < steps.length) {
      setProgress(steps[stepIdx][0], steps[stepIdx][1]);
      stepIdx++;
    }
  }, 300);

  // ── Call Python backend to generate schedule ──
  try {
    const scheduleName = `Schedule — ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`;
    const res = await fetch(`${API_BASE}/schedules/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: scheduleName,
        parsedData: State.parsed,
        lecturesPerWeek: State.lecturesPerWeek,
        datasetId: State.savedDatasetId || null,
      }),
    });

    clearInterval(progressInterval);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Server returned an error');
    }

    const { data } = await res.json();

    // Use the schedule from the Python backend response
    State.schedule = {
      byClass: data.byClass,
      byFaculty: data.byFaculty,
      byRoom: data.byRoom,
      conflicts: data.conflicts || [],
    };

    setProgress(100, 'Complete ✓');

  } catch (err) {
    clearInterval(progressInterval);
    setProgress(0, 'Failed');
    btn.disabled = false;
    btn.innerHTML = `⚡ Generate Timetable`;
    toast('Failed to generate: ' + err.message + '. Is the Python backend running?', 'error');
    return;
  }

  // Render legend
  Render.legend(State.parsed.subjects);

  // Populate selectors — only original class names (lab groups are merged in the timetable view)
  Render.selectorOptions(State.parsed.classes.map(c => c.name), 'class-selector');
  Render.selectorOptions(State.parsed.faculty.map(f => f.name), 'faculty-selector');
  Render.selectorOptions(State.parsed.classrooms.map(r => r.name), 'room-selector');

  // Render stats & conflicts
  Render.stats(State.schedule, State.parsed);
  Render.conflicts(State.schedule.conflicts);

  // Show results
  showSection('results-section');
  document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });

  // Default tab render
  switchTab('class');

  btn.disabled = false;
  btn.innerHTML = `🔄 Regenerate`;

  const conflictCount = State.schedule.conflicts.length;
  toast(conflictCount === 0
    ? '✅ Timetable generated — Graph Coloring (Welsh-Powell)'
    : `⚠️ Generated with ${conflictCount} conflict(s)`, conflictCount === 0 ? 'success' : 'warn');

  // Refresh history
  loadHistory();

  await new Promise(r => setTimeout(r, 1200));
  setProgress(0, 'Ready');
}

// ── Load saved schedule history from MongoDB ──────────────────────────────────
async function loadHistory() {
  const container = document.getElementById('history-list');
  if (!container) return;
  try {
    const res = await fetch(`${API_BASE}/schedules`);
    if (!res.ok) throw new Error();
    const { data } = await res.json();
    if (!data.length) {
      container.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;padding:12px 0;">No saved schedules yet. Generate one above!</p>`;
      return;
    }
    container.innerHTML = data.map(s => `
      <div class="history-item" id="hist-${s._id}">
        <div class="history-info">
          <div class="history-name">${s.name}</div>
          <div class="history-meta">
            <span>Mode: ${s.algorithmMode}</span>
            <span>Efficiency: ${s.stats?.efficiency ?? '?'}%</span>
            <span>Conflicts: ${s.stats?.conflictCount ?? '?'}</span>
            <span>${new Date(s.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
        </div>
        <button class="btn btn-sm btn-outline" onclick="deleteSchedule('${s._id}')" title="Delete">🗑️</button>
      </div>
    `).join('');
  } catch {
    container.innerHTML = `<p style="color:var(--text-muted);font-size:0.82rem;padding:12px 0;">Could not connect to server. Start the backend to see history.</p>`;
  }
}

async function deleteSchedule(id) {
  try {
    await fetch(`${API_BASE}/schedules/${id}`, { method: 'DELETE' });
    document.getElementById(`hist-${id}`)?.remove();
    toast('Schedule deleted from database');
    const container = document.getElementById('history-list');
    if (container && !container.children.length) loadHistory();
  } catch {
    toast('Could not delete — server unreachable', 'error');
  }
}

// ── Save dataset to MongoDB when file is loaded ───────────────────────────────
async function saveDatasetToAPI(name, rawText, parsed) {
  try {
    const res = await fetch(`${API_BASE}/datasets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rawText, parsed }),
    });
    if (res.ok) {
      const { data } = await res.json();
      State.savedDatasetId = data._id;
    }
  } catch { /* silent — offline mode */ }
}

function switchTab(tab) {
  State.currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

  const classRow = document.getElementById('class-selector-row');
  const facultyRow = document.getElementById('faculty-selector-row');
  const roomRow = document.getElementById('room-selector-row');

  classRow.style.display = facultyRow.style.display = roomRow.style.display = 'none';

  let html = '';
  if (tab === 'class') {
    classRow.style.display = 'flex';
    const name = document.getElementById('class-selector').value;
    html = Render.timetableByClass(name);
  } else if (tab === 'faculty') {
    facultyRow.style.display = 'flex';
    const name = document.getElementById('faculty-selector').value;
    html = Render.timetableByFaculty(name);
  } else if (tab === 'room') {
    roomRow.style.display = 'flex';
    const name = document.getElementById('room-selector').value;
    html = Render.timetableByRoom(name);
  }
  document.getElementById('timetable-output').innerHTML = html;
}

function handleSelectorChange() {
  switchTab(State.currentTab);
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // File input
  const fileInput = document.getElementById('file-input');
  const uploadZone = document.getElementById('upload-zone');

  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => handleFileLoad(ev.target.result, file.name);
    reader.readAsText(file);
    fileInput.value = ''; // Reset so the same/different file can be re-uploaded
  });

  // Drag & drop
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault(); uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.endsWith('.txt')) { toast('Please drop a .txt file', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => handleFileLoad(ev.target.result, file.name);
    reader.readAsText(file);
  });

  uploadZone.addEventListener('click', () => fileInput.click());

  // Load sample
  document.getElementById('load-sample-btn').addEventListener('click', async () => {
    try {
      const res = await fetch('sample_data.txt');
      if (!res.ok) throw new Error('Not found');
      const text = await res.text();
      handleFileLoad(text, 'sample_data.txt');
    } catch {
      toast('Could not load sample (try opening via a local server)', 'warn');
    }
  });

  // Load history on startup
  loadHistory();

  // Format guide toggle
  const guideToggle = document.getElementById('guide-toggle');
  guideToggle.addEventListener('click', () => {
    const body = document.getElementById('guide-body');
    body.classList.toggle('open');
    guideToggle.classList.toggle('open');
  });

  // Generate
  document.getElementById('generate-btn').addEventListener('click', generateTimetable);

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Selectors
  ['class-selector','faculty-selector','room-selector'].forEach(id => {
    document.getElementById(id).addEventListener('change', handleSelectorChange);
  });

  // Export
  document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
  document.getElementById('print-btn').addEventListener('click', printSchedule);

  // Init hidden sections
  hideSection('config-section');
  hideSection('results-section');
});
