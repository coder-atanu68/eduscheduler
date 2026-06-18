"""
SCHEDULER — Graph Coloring (Modified Welsh-Powell)
DAA Mini Project | Algorithm: Graph Coloring Heuristic

This algorithm models the timetable as a Graph Coloring problem:
  1. VERTICES (Nodes): Every lecture to be scheduled is a node. Faculty is pre-assigned
     to balance loads.
  2. EDGES: An edge connects two nodes if they cannot happen at the same time
     (i.e., they share the same Class or the same Faculty).
  3. DEGREE SORTING: Nodes are sorted by their degree (number of edges) in descending
     order. This is the core of the Welsh-Powell algorithm (most constrained first).
  4. COLORING: Time slots act as "Colors". We color each node avoiding edge conflicts,
     while enforcing a maximum capacity per color (number of physical classrooms).
  5. ROOM ASSIGNMENT: After the graph is validly colored, nodes sharing the same color
     are assigned to specific physical rooms based on capacity.
"""

class Node:
    def __init__(self, node_id, cls_name, subject, faculty):
        self.id = node_id
        self.cls_name = cls_name
        self.subject = subject
        self.faculty = faculty
        self.adj = []       # List of adjacent Nodes
        self.color = None   # Tuple (day, slot)

def generate(data, lectures_per_week):
    # ── 1. Preparation & Faculty Pre-assignment ────────────────────────────
    # subject_faculty[subject] = [faculty_dict, ...]
    subject_faculty = {}
    for subject in data['subjects']:
        capable = [f for f in data['faculty'] if any(s.lower() == subject.lower() for s in f['subjects'])]
        subject_faculty[subject] = sorted(capable, key=lambda f: f['name'])

    faculty_assignment_count = {f['name']: 0 for f in data['faculty']}
    
    nodes = []
    node_id = 0
    conflicts = []

    # Create a node for every required lecture
    for cls in data['classes']:
        for subject in data['subjects']:
            count = int(lectures_per_week.get(subject, 3))
            for _ in range(count):
                capable = subject_faculty.get(subject, [])
                if not capable:
                    conflicts.append({
                        'type': 'no-faculty',
                        'class': cls['name'],
                        'subject': subject,
                        'message': f"No faculty available to teach {subject}"
                    })
                    break # Skip creating nodes if no faculty
                
                # Pre-assign the faculty with the lowest current load
                capable.sort(key=lambda f: (faculty_assignment_count[f['name']], f['name']))
                chosen_faculty = capable[0]['name']
                faculty_assignment_count[chosen_faculty] += 1
                
                nodes.append(Node(node_id, cls['name'], subject, chosen_faculty))
                node_id += 1

    # ── 2. Graph Construction (Add Edges) ──────────────────────────────────
    for i in range(len(nodes)):
        for j in range(i + 1, len(nodes)):
            n1 = nodes[i]
            n2 = nodes[j]
            # Edge condition: Same Class OR Same Faculty
            if n1.cls_name == n2.cls_name or n1.faculty == n2.faculty:
                n1.adj.append(n2)
                n2.adj.append(n1)

    # ── 3. Welsh-Powell Degree Sorting ─────────────────────────────────────
    # Sort descending by degree. Tie-breaker: node ID (determinism)
    nodes.sort(key=lambda n: (-len(n.adj), n.id))

    # ── 4. Graph Coloring ──────────────────────────────────────────────────
    all_colors = []
    for day in data['timeslots']:
        for slot in data['timeslots'][day]:
            all_colors.append((day, slot))

    # Track color capacity (max nodes per color = num classrooms)
    MAX_ROOMS = len(data['classrooms'])
    color_usage = {color: 0 for color in all_colors}

    # Tracking for soft constraints
    class_subject_day_count = {c['name']: {subj: {day: 0 for day in data['timeslots']} for subj in data['subjects']} for c in data['classes']}
    class_schedule = {c['name']: {day: {slot: None for slot in data['timeslots'][day]} for day in data['timeslots']} for c in data['classes']}

    for node in nodes:
        best_color = None
        best_score = None

        # Gather colors used by adjacent nodes
        adjacent_colors = set(adj.color for adj in node.adj if adj.color is not None)

        for color in all_colors:
            day, slot = color

            # Hard Constraint 1: Graph Coloring rule (no adjacent node has this color)
            if color in adjacent_colors:
                continue
            
            # Hard Constraint 2: Room limit per time slot
            if color_usage[color] >= MAX_ROOMS:
                continue

            # Soft Constraint Scoring
            slots_for_day = data['timeslots'][day]
            slot_idx = slots_for_day.index(slot)
            
            consecutive_penalty = 0
            if slot_idx > 0 and class_schedule[node.cls_name][day][slots_for_day[slot_idx - 1]] == node.subject:
                consecutive_penalty = 1
            if slot_idx < len(slots_for_day) - 1 and class_schedule[node.cls_name][day][slots_for_day[slot_idx + 1]] == node.subject:
                consecutive_penalty = 1

            day_count = class_subject_day_count[node.cls_name][node.subject][day]

            score = (
                consecutive_penalty,
                day_count,
                all_colors.index(color) # Deterministic tie-breaker
            )

            if best_score is None or score < best_score:
                best_score = score
                best_color = color

        if best_color:
            node.color = best_color
            color_usage[best_color] += 1
            day, slot = best_color
            class_subject_day_count[node.cls_name][node.subject][day] += 1
            class_schedule[node.cls_name][day][slot] = node.subject
        else:
            # Graph couldn't be fully colored
            conflicts.append({
                'type': 'unscheduled',
                'class': node.cls_name,
                'subject': node.subject,
                'count': 1,
                'message': f"Could not schedule 1 lecture(s) of {node.subject} for {node.cls_name} — graph coloring failed (no valid slot or room limit reached)"
            })

    # ── 5. Room Assignment ─────────────────────────────────────────────────
    # Now that the graph is colored, map colors to physical rooms
    schedule = {c['name']: {day: {slot: None for slot in data['timeslots'][day]} for day in data['timeslots']} for c in data['classes']}
    
    # Group nodes by color
    nodes_by_color = {color: [] for color in all_colors}
    for node in nodes:
        if node.color:
            nodes_by_color[node.color].append(node)

    class_lookup = {c['name']: c for c in data['classes']}

    for color, colored_nodes in nodes_by_color.items():
        if not colored_nodes:
            continue
            
        day, slot = color
        
        # Sort nodes by class strength descending (give biggest classes first pick of rooms)
        colored_nodes.sort(key=lambda n: -class_lookup[n.cls_name]['strength'])
        
        # Available rooms for this color, sorted by capacity descending
        available_rooms = sorted(data['classrooms'], key=lambda r: (-r['capacity'], r['name']))
        
        for node in colored_nodes:
            room = available_rooms.pop(0) # We proved len(colored_nodes) <= len(classrooms) earlier
            
            schedule[node.cls_name][day][slot] = {
                'subject': node.subject,
                'faculty': node.faculty,
                'room': room['name']
            }

    # ── 6. Build reverse lookups ───────────────────────────────────────────
    by_faculty = {}
    by_room = {}
    for cls_name, days in schedule.items():
        for day, slots in days.items():
            for slot, entry in slots.items():
                if entry is None:
                    continue

                fac = entry['faculty']
                if fac not in by_faculty:
                    by_faculty[fac] = {}
                if day not in by_faculty[fac]:
                    by_faculty[fac][day] = {}
                by_faculty[fac][day][slot] = {
                    'subject': entry['subject'],
                    'faculty': entry['faculty'],
                    'room': entry['room'],
                    'class': cls_name,
                }

                rm = entry['room']
                if rm not in by_room:
                    by_room[rm] = {}
                if day not in by_room[rm]:
                    by_room[rm][day] = {}
                by_room[rm][day][slot] = {
                    'subject': entry['subject'],
                    'faculty': entry['faculty'],
                    'room': entry['room'],
                    'class': cls_name,
                }

    # Deduplicate conflicts and group counts
    conflict_map = {}
    for c in conflicts:
        key = f"{c['type']}-{c['class']}-{c['subject']}"
        if key not in conflict_map:
            conflict_map[key] = c
        else:
            if 'count' in conflict_map[key]:
                conflict_map[key]['count'] += 1
                conflict_map[key]['message'] = f"Could not schedule {conflict_map[key]['count']} lecture(s) of {c['subject']} for {c['class']} — graph coloring failed (no valid slot or room limit reached)"

    return {
        'byClass': schedule,
        'byFaculty': by_faculty,
        'byRoom': by_room,
        'conflicts': list(conflict_map.values()),
    }

def strip_null_slots(by_class):
    """
    Strip null slots from byClass before saving to MongoDB.
    Null values in nested MongoDB maps cause save failures.
    """
    clean = {}
    for cls, days in by_class.items():
        clean[cls] = {}
        for day, slots in days.items():
            clean[cls][day] = {}
            for slot, entry in slots.items():
                if entry is not None:
                    clean[cls][day][slot] = entry
    return clean
