# 📅 EduScheduler — Intelligent Timetable Generator

A robust web application designed to help educational institutions generate optimal, conflict-free weekly class timetables. Powered by advanced Graph Theory, EduScheduler transforms a simple text dataset into a comprehensive, exportable schedule in seconds.

---

## ✨ Overview

EduScheduler solves the complex Constraint Satisfaction Problem of institutional scheduling by guaranteeing mathematically optimal, conflict-free schedules without brute-force guessing. 

It provides an intuitive interface for uploading constraints (faculty availability, classroom capacities, subjects), automatically generates the schedule, and offers multiple ways to view, analyze, and export the final timetable.

### Key Features
- **Deterministic Scheduling** — Powered by the Welsh-Powell Algorithm.
- **Drag & Drop Upload** — Seamlessly load `.txt` datasets.
- **Multi-Perspective Views** — Analyze the timetable by Class, Faculty, or Room.
- **Live Conflict Reporting** — Transparently exposes any logically unschedulable lectures.
- **Actionable Analytics** — View total sessions scheduled, efficiency percentages, and conflict counts.
- **Export & Print** — Download the full schedule as a CSV spreadsheet or print a clean, color-coded layout.
- **Premium UI** — Responsive, modern design system with unique color-coding per subject.

---

## ⚙️ How It Works: Graph Coloring

The core scheduling engine leverages the **Welsh-Powell Graph Coloring Algorithm** to ensure maximum efficiency.

### Theoretical Mapping:
- **Vertices (Nodes):** Individual lecture sessions required (e.g., 5 Math classes for Class 10-A).
- **Edges (Connections):** Constraints connecting two lectures that CANNOT occur simultaneously (e.g., same Teacher or same Class).
- **Colors:** The available Time Slots across the academic week.

### The Process:
1. **Parsing:** The unstructured text dataset is parsed into a strict constraint matrix.
2. **Graph Construction:** An adjacency matrix is built where intersecting constraints create edges.
3. **Prioritization:** Nodes are sorted descending by their degree (number of constraints).
4. **Greedy Coloring:** The lowest available "color" (time slot) is assigned to each node, ensuring no adjacent nodes share a color.
5. **Resource Allocation:** Classrooms are assigned dynamically based on capacity.
6. **Result Validation:** The mathematically optimal schedule is returned, with explicitly reported un-schedulable nodes handled cleanly.

---

## 📋 Dataset Format

EduScheduler reads institutional requirements via a simple `.txt` file. 

**Example Structure:**
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

## 👨‍💻 Tech Stack

- **Backend Architecture:** Python, Flask
- **Algorithm Engine:** Pure Python (Graph Theory / Welsh-Powell)
- **Frontend Interface:** HTML5, Vanilla CSS, Vanilla JavaScript
- **Database (Extensible):** PyMongo (Atlas)
