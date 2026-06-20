"""
Benchmark — Measure real execution time of the Welsh-Powell Graph Coloring scheduler
at increasing problem sizes (node counts) for the DAA Mini Project report.
"""
import time
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scheduler

def make_dataset(num_classes, num_subjects, lpw=3):
    """Generate a synthetic dataset with a controlled number of nodes."""
    subjects = [f"Subject_{i+1}" for i in range(num_subjects)]
    faculty = []
    for i, subj in enumerate(subjects):
        faculty.append({'name': f"Prof_{i+1}", 'subjects': [subj]})
        faculty.append({'name': f"Dr_{i+1}", 'subjects': [subj]})

    classrooms = []
    # Enough rooms so room limits don't block coloring
    for i in range(max(num_classes + 2, 6)):
        classrooms.append({'name': f"Room_{i+1}", 'capacity': 60})

    classes = []
    for i in range(num_classes):
        classes.append({'name': f"Class_{chr(65+i) if i < 26 else str(i)}", 'strength': 40})

    # 5 days × 5 slots = 25 colors
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    timeslots = {d: [f"{9+h}:00-{10+h}:00" for h in range(5)] for d in days}

    lectures_per_week = {s: lpw for s in subjects}

    data = {
        'subjects': subjects,
        'faculty': faculty,
        'classrooms': classrooms,
        'classes': classes,
        'timeslots': timeslots,
    }
    return data, lectures_per_week


def count_nodes(num_classes, num_subjects, lpw):
    """Predict the number of graph nodes that will be created."""
    return num_classes * num_subjects * lpw


# ── Define test configurations ──
# Each config: (num_classes, num_subjects, lpw) → approximate node count
configs = [
    (2,  5,  3),   # ~30 nodes
    (3,  6,  3),   # ~54 nodes
    (3,  8,  3),   # ~72 nodes  (≈ your real dataset)
    (4,  8,  3),   # ~96 nodes
    (5,  8,  3),   # ~120 nodes
    (5, 10,  3),   # ~150 nodes
    (6, 10,  3),   # ~180 nodes
    (5, 10,  4),   # ~200 nodes
    (6, 12,  4),   # ~288 nodes
    (8, 12,  4),   # ~384 nodes
    (8, 14,  4),   # ~448 nodes
    (10, 14, 4),   # ~560 nodes
]

print("=" * 60)
print("  BENCHMARK: Welsh-Powell Graph Coloring Scheduler")
print("  DAA Mini Project — EduScheduler")
print("=" * 60)
print()
print(f"{'Nodes':<10} {'Classes':<10} {'Subjects':<10} {'LPW':<6} {'Time (ms)':<12} {'Conflicts':<10}")
print("-" * 60)

results = []

for num_c, num_s, lpw in configs:
    expected_nodes = count_nodes(num_c, num_s, lpw)
    data, lectures_per_week = make_dataset(num_c, num_s, lpw)

    # Run 3 times and take the average for stability
    times = []
    result = None
    for _ in range(3):
        start = time.perf_counter()
        result = scheduler.generate(data, lectures_per_week)
        end = time.perf_counter()
        times.append((end - start) * 1000)  # ms

    avg_time = sum(times) / len(times)
    conflicts = len(result['conflicts'])

    # Count actual scheduled nodes
    actual_nodes = 0
    for cls_days in result['byClass'].values():
        for day_slots in cls_days.values():
            for entry in day_slots.values():
                if entry is not None:
                    actual_nodes += 1
    actual_nodes += conflicts  # unscheduled nodes are still nodes

    print(f"{actual_nodes:<10} {num_c:<10} {num_s:<10} {lpw:<6} {avg_time:<12.2f} {conflicts:<10}")
    results.append((actual_nodes, avg_time))

print()
print("=" * 60)
print("  CLEAN TABLE FOR REPORT (copy this)")
print("=" * 60)
print()
print(f"{'Nodes':<10} {'Time (ms)':<10}")
print("-" * 22)
for nodes, t in results:
    print(f"{nodes:<10} {t:<10.1f}")

print()
print("Done! Use the table above to create your bar chart in Word.")
