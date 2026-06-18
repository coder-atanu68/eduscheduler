# 📅 EduScheduler — Intelligent Timetable Generator

> **DAA Mini Project** | Constraint Satisfaction using Graph Coloring (Welsh-Powell)

A premium web application that helps educational institutions generate optimal weekly class timetables from a simple `.txt` dataset. It guarantees mathematically optimal, conflict-free schedules using graph theory.

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Python 3.8+
- pip

### Installation & Run

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the Flask Backend:**
   ```bash
   python app.py
   ```

3. **Open the App:**
   Open your browser and navigate to: [http://localhost:5000](http://localhost:5000)

*(The Python backend automatically serves the frontend interface while exposing the `POST /api/schedules/generate` endpoint for the scheduler).*

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

## ⚙️ Algorithm (Graph Coloring)

The core scheduling logic uses the **Welsh-Powell Graph Coloring Algorithm** to ensure a highly efficient, deterministic schedule.

### How it maps to Graph Theory:
- **Vertices (Nodes):** Every individual lecture session required (e.g., 5 Math classes for Class 10-A).
- **Edges (Connections):** A line is drawn between two lectures if they CANNOT happen at the same time (i.e., they share the same Teacher, or the same Class).
- **Colors:** The available Time Slots across the week.

### Algorithm Steps:
1. Parse the text dataset into a list of required sessions.
2. Build an adjacency matrix where intersecting constraints (same faculty/class) create edges.
3. Calculate the degree (number of constraints) for each node.
4. Sort all nodes in descending order of their degree.
5. Greedily assign the lowest available "color" (time slot) to each node, ensuring no adjacent nodes share a color.
6. Assign classrooms based on capacity.
7. Return the mathematically optimal schedule, explicitly reporting any un-schedulable nodes as "Conflicts".

---

## 🎨 Features

- **Graph-Theory Scheduler** — 100% deterministic and extremely fast.
- **Drag & Drop Upload** — load any `.txt` file.
- **3 Timetable Views** — By Class, By Faculty, By Room.
- **Live Conflict Report** — transparently exposes unscheduled lectures.
- **Statistics Dashboard** — sessions scheduled, efficiency %, conflict count.
- **CSV Export** — download full schedule as spreadsheet.
- **Color-coded subjects** — each subject has a unique visual identity.
- **Responsive** — works on mobile, tablet, and desktop.

---

## 📁 File Structure

```
Mini Project/
├── app.py           ← Flask backend server
├── scheduler.py     ← Core Welsh-Powell algorithm logic
├── parser.py        ← Custom text parser
├── requirements.txt ← Python dependencies
├── index.html       ← Main application UI
├── style.css        ← Premium design system
├── app.js           ← Frontend state logic
└── sample_data.txt  ← Demo dataset
```

---

## 👨‍💻 Tech Stack

- **Backend:** Python, Flask
- **Algorithm:** Pure Python (Graph Coloring / Welsh-Powell)
- **Frontend:** HTML5, Vanilla CSS, Vanilla JavaScript
- **Database (Optional/Extensible):** PyMongo (Atlas) for saved histories
