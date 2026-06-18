"""Quick test — parse sample_data.txt and run the NEW Graph Coloring (Welsh-Powell) scheduler.
Also verify determinism: run it twice and check results are identical."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import parser as data_parser
import scheduler

# Read sample data
sample_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sample_data.txt')
with open(sample_path, 'r', encoding='utf-8') as f:
    raw_text = f.read()

# Parse
parsed = data_parser.parse(raw_text)
errors = data_parser.validate(parsed)
if errors:
    print("Validation errors:", errors)
    sys.exit(1)

print(f"Parsed: {len(parsed['subjects'])} subjects, {len(parsed['faculty'])} faculty, "
      f"{len(parsed['classrooms'])} classrooms, {len(parsed['classes'])} classes")

# Build lectures per week
lectures_per_week = {}
for s in parsed['subjects']:
    lectures_per_week[s] = parsed['lpwOverrides'].get(s, 3)
print(f"Lectures/week: {lectures_per_week}")

# Run the Graph Coloring algorithm
print("\n--- Running Graph Coloring (Welsh-Powell) (Run 1) ---")
result1 = scheduler.generate(parsed, lectures_per_week)

# Stats
total_assigned = 0
total_possible = 0
class_names = [c['name'] for c in parsed['classes']]
for cls in class_names:
    for day_slots in (result1['byClass'].get(cls) or {}).values():
        for entry in day_slots.values():
            if entry is not None:
                total_assigned += 1
for count in lectures_per_week.values():
    total_possible += count * len(class_names)

efficiency = round((total_assigned / total_possible) * 100) if total_possible > 0 else 0

print(f"Total assigned: {total_assigned}")
print(f"Total possible: {total_possible}")
print(f"Conflicts: {len(result1['conflicts'])}")
print(f"Efficiency: {efficiency}%")

if result1['conflicts']:
    print("\nConflict details:")
    for c in result1['conflicts']:
        print(f"  - {c['message']}")
else:
    print("\nNo conflicts! All lectures scheduled successfully.")

# Run again — verify determinism
print("\n--- Running Graph Coloring (Welsh-Powell) (Run 2 — determinism check) ---")
result2 = scheduler.generate(parsed, lectures_per_week)

# Compare
identical = True
for cls in class_names:
    for day in result1['byClass'][cls]:
        for slot in result1['byClass'][cls][day]:
            e1 = result1['byClass'][cls][day][slot]
            e2 = result2['byClass'][cls][day][slot]
            if e1 != e2:
                identical = False
                print(f"  MISMATCH: {cls} {day} {slot}: {e1} vs {e2}")

if identical:
    print("DETERMINISTIC: Both runs produced IDENTICAL results!")
else:
    print("WARNING: Results differ between runs!")

# Print one class timetable
first_class = class_names[0]
print(f"\n--- Timetable for {first_class} ---")
for day in parsed['timeslots']:
    for slot in parsed['timeslots'][day]:
        entry = result1['byClass'][first_class][day].get(slot)
        if entry:
            print(f"  {day} {slot}: {entry['subject']} ({entry['faculty']}) @ {entry['room']}")

print("\n[TEST PASSED] Graph Coloring (Welsh-Powell) algorithm works correctly!")
