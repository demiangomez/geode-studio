# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GPS/GNSS Data Management API** - A Django REST Framework API for managing GNSS (Global Navigation Satellite System) station data, including coordinates, antennas, receivers, earthquakes, and processing results.

> **Important context (2026-06):**
> - This repository is **backend-only**. The frontend (time series / ETM / map pages, modals, jumps table) lives in a **separate repository** (UI screenshots under `iso/etapa_*/fotos_test/`).
> - The stage-3 tables `gamit_projects`, `reference_frames` and `reference_frame_constraints` (geode 1.2.68 ships their DDL disabled, `run_this = False` in `dbConnection.py`) were created in the **development** db with `db/create_etapa3_schema.py`; they must exist in any db this backend runs against (`/api/gamit-projects`, `/api/reference-frames`, `/api/distinct-stack-names`), otherwise those endpoints fail with "relation does not exist". `gamit_projects` is the parent of `gamit_soln`/`gamit_soln_excl`/`gamit_subnets`/`gamit_stats`/`gamit_antenna_residuals` (FK `ON UPDATE/DELETE CASCADE`), so deleting or renaming a project through the API affects those tables too.
> - **Campaign Planner** (issue 2026-09): `POST /api/campaign-planner` runs geode's `campaign_planner.planner.plan_campaign` (the web-safe entry point of `com/CampaignPlanner.py`) and returns `{html, plan}`; `GET /api/campaign-planner/geocode?q=` geocodes a city with the planner's geocoder (Nominatim), for the map before planning. The planner calls public services **from the backend** (Nominatim, the OSRM demo router, unpkg for Leaflet, OSM tiles for the print map), so the container needs outbound internet; a plan takes seconds. `campaign_plans` (`models.CampaignPlans`, CRUD `/api/campaign-plans`) is a **Django-managed** table created by migration `0066` (unlike the geode tables above), it stores only the parameters (no FK to `Campaigns`) and the plan is generated again from them. Its endpoints live in the **`campaigns`** clusters (migration `0067`), no resource of their own.
> - The scientific subsystem has been **migrated** from the now-frozen **`pgamit`** library to its successor **`geode-gnss`** (installed: `geode-gnss` **1.2.68**, `pip install geode-gnss`, import module `geode`, repo `github.com/demiangomez/geode`). **pgamit is no longer a dependency** — it is not imported anywhere and not installed in the venv; everything routes through `geode`. The ETM / time-series code uses geode's `EtmEngine` / `EtmConfig` API (geode has **no** `GamitETM` / `PPPETM` / `todictionary`). Station metadata comes from `geode.metadata.station_info` (class `StationInfo`); DB connection uses `gnss_data.cfg` `[postgres]` via `geode.dbConnection.Cnn` (the cfg is config-compatible with the old pgamit one). Note: a few identifiers/strings in `api/views.py` (the station-info parsing endpoints) and some Swagger descriptions still read "pgamit" by inertia, but they instantiate geode's `StationInfo` — cosmetic only.

## Architecture

### High-Level Structure

```
gps/
├── backend/                  # Django backend application
│   ├── backend_django_project/  # Django project root
│   │   ├── api/             # Main REST API app (~5000 lines)
│   │   │   ├── models.py    # ~30 data models (Antennas, Stations, Networks, etc.)
│   │   │   ├── views.py     # REST views with List/Detail pairs
│   │   │   ├── serializers.py  # DRF serializers
│   │   │   ├── permissions.py  # Role-based access control
│   │   │   ├── filters.py   # Query filtering
│   │   │   └── utils.py     # Utility functions (image processing, calculations)
│   │   └── backend_django_project/  # Django settings
│   │       ├── settings.py  # Redis caching, Celery, JWT auth, drf-spectacular
│   │       ├── urls.py      # API routing
│   │       └── celery.py    # Async task configuration
│   ├── update_gaps_status_client/  # Scheduled client for gap status updates
│   ├── docs/                # API documentation (schema.yml, Postman collection)
│   ├── Dockerfile           # Python 3.11, Gunicorn, Supervisor, Redis
│   ├── supervisord.conf     # Manages Gunicorn, Celery, Redis, update client
│   └── requirements.txt      # Django 5.0, DRF, Celery, Redis, geode-gnss library
├── db/                      # Database utilities
│   ├── remove_django_objects_db.py  # Script to clean Django-created tables
│   └── env_example.txt
├── docker-compose.yml       # Single backend service
└── db_initial_schema.sql    # PostgreSQL schema initialization
```

### Key Dependencies & Services

- **Django 5.0.4** with Django REST Framework
- **PostgreSQL** (via psycopg2) - primary data store
- **Redis** - caching, Celery broker
- **Celery** - async task queue
- **drf-spectacular** (modified in `modified_packages/`) - OpenAPI/Swagger documentation
- **JWT Authentication** via `rest_framework_simplejwt`
- **Role-based Permissions** - custom permission system in `api/permissions.py`
- **geode-gnss library** (`import geode`) - Comprehensive Python framework for automated GNSS data processing, analysis, and management. Integrates multiple geodetic software packages (GAMIT/GLOBK, GPSPACE, and soon M-PAGES) with PostgreSQL database management and web-based visualization tools. Successor to the now-frozen pgamit. *(This backend uses the ETM / time-series and station-metadata parts.)*
- **Gunicorn** - WSGI server (port 8000)

### Database

- Uses existing PostgreSQL schema mapped via Django ORM
- Models based on existing tables with custom field mappings
- 86 migration files preserve schema integrity
- Test database created with naming pattern: `test_{PRODUCTION_DB_NAME}`

### API Design

All endpoints follow RESTful patterns with pagination and filtering:

**Pattern:** `/api/{resource}` (list/create) and `/api/{resource}/{id}` (retrieve/update/delete)

**Authentication:** JWT tokens via `/api/token` endpoint

**Key Features:**
- Custom pagination with count + total_count in responses
- Role-based endpoint permissions
- Django Audit Log tracking
- Standardized error handling via `drf_standardized_errors`
- CORS enabled for all origins
- Multi-cache system (default + earthquakes_affected_stations)

## Development Workflow

### Setup

1. **Create virtual environment and install dependencies:**
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   - Copy `backend/conf_example.txt` to `backend/gnss_data.cfg`
   - Update PostgreSQL credentials, secret key, and file upload settings
   - Example config template in `/backend/conf_example.txt`

3. **Environment variables:**
   - Create `.env` in project root with `MEDIA_FOLDER_HOST_PATH`, `ARCHIVE_FOLDER_HOST_PATH` (rinex archive, `archive_osu` on the server; mounted read-only at `/code/backend_django_project/archive_osu`, which is what `[archive] path` of `gnss_data.cfg` must say), `USER_ID_TO_SAVE_FILES`, `GROUP_ID_TO_SAVE_FILES`
   - See `.env.sample` for template

### Running the Project

**Via Docker:**
```bash
docker-compose up --build
# API available at http://localhost:8000/api
```

**Locally (development):**
```bash
cd backend/backend_django_project
python manage.py migrate  # Apply pending migrations
python manage.py runserver
```

**Supervisor services** (in Docker only):
- Gunicorn (port 8000)
- Celery worker
- Redis server
- Update gaps status client script

### Database Management

**Run migrations:**
```bash
cd backend/backend_django_project
python manage.py migrate
```

**Create test database:**
```bash
# Database must be named: test_{PRODUCTION_DB_NAME}
cd db
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Edit .env with test DB credentials
python remove_django_objects_db.py  # Clean up for fresh test DB
```

### Testing

```bash
cd backend/backend_django_project
python manage.py test --keepdb  # Runs tests/tests.py with persistent DB
```

**Test credentials** (hardcoded in tests.py):
- admin / admin
- underprivileged_front / underprivileged_front
- underprivileged_api / underprivileged_api

**Note:** Tests require a pre-created test database with the same schema as production.

### API Documentation

**View interactive API docs:**
```bash
cd backend/docs
sudo docker run -p 8080:8080 -e SWAGGER_JSON=/schema.yml -v ${PWD}/schema.yml:/schema.yml swaggerapi/swagger-ui
# Open http://localhost:8080
```

**Documentation files:**
- `schema.yml` - OpenAPI 3.0 specification (auto-generated)
- `GPS.postman_collection.json` - Postman collection

## Code Patterns & Key Files

### Models (api/models.py)

- **BaseModel** - Base class normalizing Decimal fields to remove trailing zeros
- **30+ domain models** - Antennas, Stations, Networks, Earthquakes, GamitResults, etc.
- All models inherit from `BaseModel` and are `managed=False` (existing schema)
- Custom fields in `api/custom_fields.py`

### Views (api/views.py)

- **CustomListAPIView** - List views with count/total_count
- **CustomListCreateAPIView** - List + create views with count metadata
- Consistent List/Detail pattern: `{Resource}List` and `{Resource}Detail` classes
- Special views: UserPhoto, HealthCheck, DistinctStackNames, earthquake affected stations

### Serializers (api/serializers.py)

- Pair with each model (ModelSerializer)
- Handle nested relationships and custom fields
- Field validation and transformation

### Permissions (api/permissions.py)

- **RolePermission** - Checks user role against allowed endpoints
- Special handling for "update-gaps-status" user
- Token endpoints always allowed
- Custom endpoint allowlist system
- The check is a flat `(path, method)` lookup across every `EndPointsCluster` attached to the role (`check_has_endpoint_api`/`_frontend`) — a cluster's `resource` (e.g. "stations", "campaigns") is just a label for the Roles admin UI, it does **not** restrict which endpoints that cluster can contain or enforce. Because of this, clusters like `stations` intentionally duplicate GET endpoints that "belong" to other resources (`campaigns`, `sources-servers`, `overview`, `people`, `monument-types`, ...) whenever the Station page needs that data — granting a role `stations: read` also grants it those specific duplicated endpoints, not just `/api/stations*`. Some endpoints (e.g. `events`, `networks`) have no standalone `Resource`/cluster of their own at all — they're only reachable by being bundled into another resource's cluster.

### Utilities (api/utils.py)

- Image processing (thumbnail generation, base64 encoding)
- GNSS calculations and transformations
- Database raw SQL queries
- Integration with geode library for station metadata

## Cache Strategy

**Redis caches** (default 1 hour):
- `default` - General caching (hash: redis://127.0.0.1:6379/0)
- `earthquakes_affected_stations_cache` - Earthquake-related queries (hash: redis://127.0.0.1:6379/1)

Clear cache endpoint: `/api/remove-earthquakes-affected-stations-cache`

## Async Tasks (Celery)

- **Broker & Result Backend:** Redis
- **Serialization:** JSON
- **Main tasks:** `update_gaps_status` (gap status updates) and `update_planned_visits_status` (marks planned visits as done once their date is reached) in `api/tasks.py`
- Configured in `backend_django_project/celery.py`

## Configuration

**Settings source:** `backend/gnss_data.cfg`

Key config parameters:
- `[postgres]` - DB connection (hostname, username, password, database, port)
- `[django]` - DEBUG, HTTPS, SECRET_KEY, file size limits, rinex status span
- `[archive]` (+ `[otl]`, `[ppp]` with `frames`/`atx`) - read by geode's `pyOptions.ReadOptions` (via `pyArchiveStruct.RinexStruct`) for the rinex download endpoint (`/api/rinex/<id>/download`, see `RinexUtils.get_rinex_file`); `path` is the archive root: in Docker `/code/backend_django_project/archive_osu`, where `ARCHIVE_FOLDER_HOST_PATH` (`archive_osu` on the server, next to the media folder) is mounted. The endpoint sends the archived CRINEZ as is (no `pyRinex.ReadRinex` / header normalization, so no external binaries needed).

Configuration is loaded in `settings.py` via configparser.

## Important Implementation Details

### File Uploads

- Configurable max size for images (default 75MB)
- Configurable max size for files (default 75MB)
- Files saved with configurable user/group ownership via `USER_ID_TO_SAVE_FILES` and `GROUP_ID_TO_SAVE_FILES`
- Media folder mounted as Docker volume

### Earthquake Data

- Earthquakes table with location and magnitude
- Cached calculation of affected stations
- Filter endpoints by earthquake ID for related data

### Update Gaps Status Client

- Standalone Python client (`update_gaps_status_client/update_gaps_status_client.py`)
- Runs on 2-hour timeout
- Authenticated via special "update-gaps-status" user credentials
- Triggers `/api/update-gaps-status` and `/api/delete-update-gaps-status-block` endpoints
- Supervised by Supervisor in Docker environment

### Custom DRF Packages

- `drf-spectacular` (modified) - Generates OpenAPI schema
- Modifications stored in `modified_packages/drf-spectacular/` to fix bugs

## Common Tasks

**Add a new API endpoint:**
1. Create model in `api/models.py` (if needed)
2. Create serializer in `api/serializers.py`
3. Create List/Detail views in `api/views.py`
4. Add URL patterns in `api/urls.py`
5. If the endpoint should be restricted, write a data migration (`RunPython`, see `0061_register_reference_frames_endpoints.py`) that creates the `Endpoint` row and adds it to the `EndPointsCluster`(s) that need it — usually its own resource's cluster, but also any other resource's cluster whose front page consumes this endpoint (see the Permissions note above). Do **not** touch `api/permissions.py` for this — it's generic, DB-driven code.

**Debug API request:**
1. Check endpoint permissions in `api/permissions.py`
2. Check role-based endpoint access in database via RolePermission
3. View API docs at http://localhost:8080 (Swagger)
4. Check request/response logs in Docker stdout

**Database schema changes:**
- Do NOT modify existing tables (schema is external)
- Create Django migration only if adding new Django-managed tables
- Use `python manage.py makemigrations` then `python manage.py migrate`

**Performance optimization:**
- Use appropriate cache (default or earthquakes_affected_stations)
- Check prefetch_related() in views (e.g., in StationList view)
- Monitor Celery task queue for async bottlenecks

