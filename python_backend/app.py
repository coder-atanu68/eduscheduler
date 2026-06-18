"""
EDUSCHEDULER — Python/Flask Backend Server
Exact replacement of the Node.js/Express backend (server.js + routes/).

All API endpoints, request/response contracts, and MongoDB collection
structures are identical to the Node.js version so the frontend (app.js)
works without any changes.

Endpoints:
  GET    /api/health                 Health check
  POST   /api/schedules/generate     Generate & save schedule
  GET    /api/schedules              List all schedules
  GET    /api/schedules/<id>         Get single schedule
  DELETE /api/schedules/<id>         Delete schedule
  POST   /api/datasets              Upload & save dataset
  GET    /api/datasets              List all datasets
  GET    /api/datasets/<id>         Get single dataset
  DELETE /api/datasets/<id>         Delete dataset
"""

import os
import math
from datetime import datetime, timezone

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from bson import ObjectId
from dotenv import load_dotenv

try:
    import certifi
    CA_CERT = certifi.where()
except ImportError:
    CA_CERT = None

import scheduler
import parser as data_parser  # avoid shadowing built-in 'parser'

# ── Load .env ──────────────────────────────────────────────────────────────────
load_dotenv()

# ── Flask App ──────────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder=None)
CORS(app)

# ── MongoDB Connection ─────────────────────────────────────────────────────────
MONGODB_URI = os.getenv('MONGODB_URI', '')
PORT = int(os.getenv('PORT', 5000))

client = None
db = None


def connect_db():
    """Connect to MongoDB Atlas. Same DB name as Node.js backend: 'eduscheduler'."""
    global client, db
    try:
        # Use certifi CA bundle if available (fixes SSL issues on MSYS2/Windows)
        connect_kwargs = {}
        if CA_CERT:
            connect_kwargs['tlsCAFile'] = CA_CERT
        client = MongoClient(MONGODB_URI, **connect_kwargs)
        # Force a connection check
        client.admin.command('ping')
        db = client['eduscheduler']
        host = client.address[0] if client.address else 'unknown'
        print(f"[OK] MongoDB Connected: {host}")
    except ConnectionFailure as e:
        print(f"[ERROR] MongoDB Connection Error: {e}")
        # Don't exit - allow offline mode like the frontend does
    except Exception as e:
        print(f"[ERROR] MongoDB Connection Error: {e}")


# ── Helper: Convert ObjectId for JSON ──────────────────────────────────────────
def serialize_doc(doc):
    """Convert MongoDB document for JSON response.
    Converts _id from ObjectId to string, converts datetime objects."""
    if doc is None:
        return None
    doc = dict(doc)
    if '_id' in doc:
        doc['_id'] = str(doc['_id'])
    if 'datasetId' in doc and isinstance(doc['datasetId'], ObjectId):
        doc['datasetId'] = str(doc['datasetId'])
    if 'createdAt' in doc and isinstance(doc['createdAt'], datetime):
        doc['createdAt'] = doc['createdAt'].isoformat()
    return doc


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════════════
@app.route('/api/health', methods=['GET'])
def health_check():
    """GET /api/health — same as Node.js server.js line 22-24."""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now(timezone.utc).isoformat(),
    })


# ═══════════════════════════════════════════════════════════════════════════════
# SCHEDULES ROUTES — Replaces backend/routes/schedules.js
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/schedules/generate', methods=['POST'])
def generate_schedule():
    """
    POST /api/schedules/generate — Generate and save a schedule.
    Uses deterministic Backtracking + MRV algorithm (single run, no modes).
    """
    try:
        body = request.get_json()
        name = body.get('name')
        parsed_data = body.get('parsedData')
        lectures_per_week = body.get('lecturesPerWeek', {})
        dataset_id = body.get('datasetId')

        if not name or not parsed_data:
            return jsonify({'success': False, 'message': 'name and parsedData are required'}), 400

        # Run the deterministic Backtracking + MRV algorithm
        result = scheduler.generate(parsed_data, lectures_per_week)

        # Compute stats — exact same as schedules.js lines 177-189
        total_assigned = 0
        total_possible = 0
        class_names = [c['name'] for c in parsed_data['classes']]

        for cls in class_names:
            for day_slots in (result['byClass'].get(cls) or {}).values():
                for entry in day_slots.values():
                    if entry is not None:
                        total_assigned += 1

        for count in lectures_per_week.values():
            # JS: totalPossible += count * classes.length
            # Note: count might be string from JSON, convert to int
            total_possible += int(count) * len(class_names)

        efficiency = round((total_assigned / total_possible) * 100) if total_possible > 0 else 0

        # Strip null slots before saving — same as JS stripNullSlots()
        clean_by_class = scheduler.strip_null_slots(result['byClass'])

        # Save to MongoDB — same document structure as Mongoose Schedule model
        doc = {
            'name': name,
            'datasetId': ObjectId(dataset_id) if dataset_id else None,
            'algorithmMode': 'graph-coloring-welsh-powell',
            'lecturesPerWeek': lectures_per_week,
            'byClass': clean_by_class,
            'byFaculty': result['byFaculty'],
            'byRoom': result['byRoom'],
            'conflicts': result['conflicts'],
            'stats': {
                'totalAssigned': total_assigned,
                'totalPossible': total_possible,
                'conflictCount': len(result['conflicts']),
                'efficiency': efficiency,
            },
            'createdAt': datetime.now(timezone.utc),
        }

        if db is not None:
            inserted = db.schedules.insert_one(doc)
            doc['_id'] = inserted.inserted_id

        return jsonify({'success': True, 'data': serialize_doc(doc)}), 201

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/schedules', methods=['GET'])
def list_schedules():
    """
    GET /api/schedules — List all schedules.
    Exact same as schedules.js lines 213-221.
    Returns: name, algorithmMode, stats, createdAt, datasetId (sorted by createdAt desc).
    """
    try:
        if db is None:
            return jsonify({'success': True, 'count': 0, 'data': []})

        schedules = list(
            db.schedules.find(
                {},
                {'name': 1, 'algorithmMode': 1, 'stats': 1, 'createdAt': 1, 'datasetId': 1}
            ).sort('createdAt', -1)
        )

        return jsonify({
            'success': True,
            'count': len(schedules),
            'data': [serialize_doc(s) for s in schedules],
        })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/schedules/<schedule_id>', methods=['GET'])
def get_schedule(schedule_id):
    """
    GET /api/schedules/:id — Get full schedule.
    Exact same as schedules.js lines 225-233.
    """
    try:
        if db is None:
            return jsonify({'success': False, 'message': 'Database not connected'}), 500

        schedule_doc = db.schedules.find_one({'_id': ObjectId(schedule_id)})
        if not schedule_doc:
            return jsonify({'success': False, 'message': 'Schedule not found'}), 404

        return jsonify({'success': True, 'data': serialize_doc(schedule_doc)})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/schedules/<schedule_id>', methods=['DELETE'])
def delete_schedule(schedule_id):
    """
    DELETE /api/schedules/:id — Delete a schedule.
    Exact same as schedules.js lines 236-244.
    """
    try:
        if db is None:
            return jsonify({'success': False, 'message': 'Database not connected'}), 500

        result = db.schedules.delete_one({'_id': ObjectId(schedule_id)})
        if result.deleted_count == 0:
            return jsonify({'success': False, 'message': 'Schedule not found'}), 404

        return jsonify({'success': True, 'message': 'Schedule deleted'})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# DATASETS ROUTES — Replaces backend/routes/datasets.js
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/datasets', methods=['POST'])
def create_dataset():
    """
    POST /api/datasets — Upload & save a dataset.
    Exact same as datasets.js lines 51-63.
    """
    try:
        body = request.get_json()
        name = body.get('name')
        raw_text = body.get('rawText')

        if not name or not raw_text:
            return jsonify({'success': False, 'message': 'name and rawText are required'}), 400

        parsed = data_parser.parse(raw_text)
        if not parsed['subjects']:
            return jsonify({'success': False, 'message': 'No subjects found in dataset'}), 400

        doc = {
            'name': name,
            'rawText': raw_text,
            'parsed': parsed,
            'createdAt': datetime.now(timezone.utc),
        }

        if db is not None:
            inserted = db.datasets.insert_one(doc)
            doc['_id'] = inserted.inserted_id

        return jsonify({'success': True, 'data': serialize_doc(doc)}), 201

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/datasets', methods=['GET'])
def list_datasets():
    """
    GET /api/datasets — List all datasets.
    Exact same as datasets.js lines 67-73.
    Returns: name, createdAt, parsed.subjects, parsed.classes (sorted by createdAt desc).
    """
    try:
        if db is None:
            return jsonify({'success': True, 'count': 0, 'data': []})

        datasets = list(
            db.datasets.find(
                {},
                {
                    'name': 1,
                    'createdAt': 1,
                    'parsed.subjects': 1,
                    'parsed.classes': 1,
                }
            ).sort('createdAt', -1)
        )

        return jsonify({
            'success': True,
            'count': len(datasets),
            'data': [serialize_doc(d) for d in datasets],
        })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/datasets/<dataset_id>', methods=['GET'])
def get_dataset(dataset_id):
    """
    GET /api/datasets/:id — Get single dataset.
    Exact same as datasets.js lines 77-85.
    """
    try:
        if db is None:
            return jsonify({'success': False, 'message': 'Database not connected'}), 500

        dataset_doc = db.datasets.find_one({'_id': ObjectId(dataset_id)})
        if not dataset_doc:
            return jsonify({'success': False, 'message': 'Dataset not found'}), 404

        return jsonify({'success': True, 'data': serialize_doc(dataset_doc)})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/datasets/<dataset_id>', methods=['DELETE'])
def delete_dataset(dataset_id):
    """
    DELETE /api/datasets/:id — Delete a dataset.
    Exact same as datasets.js lines 88-96.
    """
    try:
        if db is None:
            return jsonify({'success': False, 'message': 'Database not connected'}), 500

        result = db.datasets.delete_one({'_id': ObjectId(dataset_id)})
        if result.deleted_count == 0:
            return jsonify({'success': False, 'message': 'Dataset not found'}), 404

        return jsonify({'success': True, 'message': 'Dataset deleted'})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# SERVE FRONTEND (same as server.js lines 27-31)
# ═══════════════════════════════════════════════════════════════════════════════
FRONTEND_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve static frontend files from the parent directory (index.html, app.js, style.css, etc.)."""
    # Don't serve for /api routes (already handled above)
    if path.startswith('api/'):
        return jsonify({'success': False, 'message': 'Not found'}), 404

    file_path = os.path.join(FRONTEND_PATH, path)
    if path and os.path.isfile(file_path):
        return send_from_directory(FRONTEND_PATH, path)

    # Default: serve index.html (SPA fallback)
    return send_from_directory(FRONTEND_PATH, 'index.html')


# ═══════════════════════════════════════════════════════════════════════════════
# START SERVER
# ═══════════════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    connect_db()
    print(f"[START] EduScheduler Python server running on port {PORT}")
    print(f"        Environment: {os.getenv('NODE_ENV', 'development')}")
    app.run(host='0.0.0.0', port=PORT, debug=True)
