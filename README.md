# 📅 EduScheduler — Intelligent Timetable Generator

> **DAA Mini Project** | Constraint-Based Greedy Scheduling Algorithm

A premium web application that helps educational institutions generate optimal weekly class timetables from a simple `.txt` dataset — with zero backend required.

---

## 🚀 Getting Started

### Option 1 — Open directly in browser
> ⚠️ The **"Try Sample Data"** button requires a local server (due to `fetch()`). Direct file loading (drag/drop) works without a server.

Just double-click `index.html` to open.

### Option 2 — Run with a local server (recommended)

```bash
# Using Python
python -m http.server 8080

# Using Node.js (npx)
npx serve .

# Using VS Code
# Install "Live Server" extension → Right-click index.html → "Open with Live Server"
```

Then open `http://localhost:8080` in your browser.

---

## 📋 Dataset Format

Create a `.txt` file with the following sections:

```
[SUBJECTS]
Mathematics
Physics
Chemistry

[FACULTY]
Dr. A. Sharma  | Mathematics, Physics
Dr. B. Patel   | Chemistry

[CLASSROOMS]
Room 101  | 45
Lab A     | 30

[TIMESLOTS]
Monday    | 09:00-10:00, 10:00-11:00, 11:15-12:15
Tuesday   | 09:00-10:00, 10:00-11:00

[CLASSES]
Class 10-A | 42
Class 11-B | 35

[LECTURES_PER_WEEK]
Mathematics | 5
Physics     | 4
```

---

## ⚙️ Algorithm

### Constraint Types

**Hard Constraints** (never violated):
- A faculty member cannot teach two classes simultaneously
- A classroom cannot host two classes at the same time
- A class cannot have two subjects at the same time slot
- Faculty can only teach their declared subjects

**Soft Constraints** (minimized):
- Avoid consecutive same-subject lectures
- Distribute lectures evenly across the week
- Prefer smaller rooms (efficient use of resources)

### Algorithm Steps
1. Parse `.txt` into structured data objects
2. Build all `(class, subject)` requirements with lecture counts
3. Shuffle requirements for variety across regenerations
4. For each requirement, iterate through randomized time slots
5. Check all hard constraints before assignment
6. Track conflicts for unresolvable cases
7. Build reverse-lookup tables (by faculty, by room)

### Algorithm Modes
| Mode | Description |
|------|-------------|
| ⚡ Fast | Single pass, quickest generation |
| ⚖️ Balanced | 3 optimization passes (default) |
| 🔬 Thorough | 6 passes, best conflict resolution |

---

## 🎨 Features

- **Drag & Drop Upload** — load any `.txt` file
- **3 Timetable Views** — By Class, By Faculty, By Room
- **Live Conflict Report** — see exactly what couldn't be scheduled and why
- **Statistics Dashboard** — sessions scheduled, efficiency %, conflict count
- **CSV Export** — download full schedule as spreadsheet
- **Print-friendly** — clean print layout
- **Color-coded subjects** — each subject has a unique visual identity
- **Responsive** — works on mobile, tablet, and desktop

---

## 📁 File Structure

```
Mini Project/
├── index.html       ← Main application
├── style.css        ← Premium design system
├── app.js           ← Scheduler + UI logic
├── sample_data.txt  ← Demo dataset
└── README.md        ← This file
```

---

## 👨‍💻 Tech Stack

- **HTML5** — Semantic markup, ARIA accessibility
- **Vanilla CSS** — Custom design system, dark mode, animations
- **Vanilla JavaScript** — Zero dependencies, runs entirely in-browser
- **Algorithm** — Constraint-based greedy scheduler with multi-pass optimization
