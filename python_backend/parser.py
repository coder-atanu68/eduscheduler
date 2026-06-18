"""
PARSER — Exact 1:1 port of the JavaScript Parser from app.js (lines 34-97)
and parseDataset() from datasets.js (lines 6-48).

Parses .txt input files with section-based format:
  [SUBJECTS], [FACULTY], [CLASSROOMS], [TIMESLOTS], [CLASSES], [LECTURES_PER_WEEK]
"""

import re


def parse(text):
    """
    Parse raw .txt text into structured data.
    Exact same logic as JS Parser.parse() in app.js lines 35-86.
    """
    sections = {}
    current_section = None

    # Split lines, strip, filter empty and comments (lines starting with #)
    # JS: text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    lines = [l.strip() for l in text.split('\n')]
    lines = [l for l in lines if l and not l.startswith('#')]

    for line in lines:
        # JS: line.match(/^\[(.+)\]$/)
        section_match = re.match(r'^\[(.+)\]$', line)
        if section_match:
            current_section = section_match.group(1).strip().upper()
            sections[current_section] = []
            continue
        if current_section:
            sections[current_section].append(line)

    # Parse subjects
    # JS: (sections['SUBJECTS'] || []).map(s => s.trim()).filter(Boolean)
    subjects = [s.strip() for s in sections.get('SUBJECTS', []) if s.strip()]

    # Parse faculty: "Name | Subject1, Subject2"
    # JS: line.split('|').map(s => s.trim()) -> { name, subjects: [...] }
    faculty = []
    for line in sections.get('FACULTY', []):
        parts = [s.strip() for s in line.split('|')]
        name = parts[0]
        subj_raw = parts[1] if len(parts) > 1 else ''
        subjs = [s.strip() for s in subj_raw.split(',') if s.strip()] if subj_raw else []
        if name:
            faculty.append({'name': name, 'subjects': subjs})

    # Parse classrooms: "Name | Capacity"
    # JS: { name: parts[0], capacity: parseInt(parts[1]) || 40 }
    classrooms = []
    for line in sections.get('CLASSROOMS', []):
        parts = [s.strip() for s in line.split('|')]
        name = parts[0]
        try:
            capacity = int(parts[1]) if len(parts) > 1 else 40
        except (ValueError, IndexError):
            capacity = 40
        if name:
            classrooms.append({'name': name, 'capacity': capacity})

    # Parse time slots: "Day | slot1, slot2, ..."
    # JS: days.find(d => d.toLowerCase() === dayRaw.toLowerCase()) || dayRaw
    canonical_days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    timeslots = {}
    for line in sections.get('TIMESLOTS', []):
        parts = [s.strip() for s in line.split('|')]
        day_raw = parts[0]
        slots_raw = parts[1] if len(parts) > 1 else ''
        # Find canonical day name (case-insensitive match)
        day = next((d for d in canonical_days if d.lower() == day_raw.lower()), day_raw)
        if slots_raw:
            timeslots[day] = [s.strip() for s in slots_raw.split(',') if s.strip()]

    # Parse classes: "Name | Strength"
    # JS: { name: parts[0], strength: parseInt(parts[1]) || 35 }
    classes = []
    for line in sections.get('CLASSES', []):
        parts = [s.strip() for s in line.split('|')]
        name = parts[0]
        try:
            strength = int(parts[1]) if len(parts) > 1 else 35
        except (ValueError, IndexError):
            strength = 35
        if name:
            classes.append({'name': name, 'strength': strength})

    # Parse lectures per week overrides
    # JS: lpwOverrides[subj] = parseInt(count) || 3
    lpw_overrides = {}
    for line in sections.get('LECTURES_PER_WEEK', []):
        parts = [s.strip() for s in line.split('|')]
        subj = parts[0] if len(parts) > 0 else ''
        count_str = parts[1] if len(parts) > 1 else ''
        if subj and count_str:
            try:
                lpw_overrides[subj] = int(count_str)
            except ValueError:
                lpw_overrides[subj] = 3

    return {
        'subjects': subjects,
        'faculty': faculty,
        'classrooms': classrooms,
        'timeslots': timeslots,
        'classes': classes,
        'lpwOverrides': lpw_overrides,
    }


def validate(data):
    """
    Validate parsed data. Exact same logic as JS Parser.validate() in app.js lines 88-96.
    """
    errors = []
    if not data['subjects']:
        errors.append('No subjects found. Add a [SUBJECTS] section.')
    if not data['faculty']:
        errors.append('No faculty found. Add a [FACULTY] section.')
    if not data['classrooms']:
        errors.append('No classrooms found. Add a [CLASSROOMS] section.')
    if not data['timeslots']:
        errors.append('No time slots found. Add a [TIMESLOTS] section.')
    if not data['classes']:
        errors.append('No classes found. Add a [CLASSES] section.')
    return errors
