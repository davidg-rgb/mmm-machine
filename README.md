# MixModel

**Measurement You Can Trust.** A cloud-based SaaS platform for Bayesian Marketing Mix Modeling that helps marketing teams measure true channel ROI.

Upload your marketing data, run Bayesian MMM analysis, and get actionable insights — no data science expertise required.

## Architecture

```
Browser → React SPA → Nginx/Vite Proxy → FastAPI → PostgreSQL
                                              ↓
                                         Celery Worker → PyMC-Marketing
                                              ↓
                                         Redis (broker + cache)
                                              ↓
                                         MinIO/S3 (file storage)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Charts | Recharts |
| State | Zustand + TanStack React Query v5 |
| Backend | Python 3.11, FastAPI, Pydantic v2 |
| Engine | PyMC-Marketing (Bayesian MMM) |
| Database | PostgreSQL 16 (JSONB for configs/results) |
| ORM | SQLAlchemy 2.0 (async) + Alembic |
| Task Queue | Celery + Redis |
| Storage | MinIO (dev) / S3 (prod) |
| Auth | JWT (access 15min / refresh 7d) |
| Monitoring | Celery Flower |

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for frontend development)

### Production (Docker)

```bash
# Clone and start all services
git clone https://github.com/davidg-rgb/mmm-machine.git
cd mmm-machine

# Copy environment file
cp .env.example .env

# Start everything (API, frontend, database, Redis, MinIO, Celery, Flower)
docker compose up -d

# Services:
#   Frontend:  http://localhost:3000
#   API:       http://localhost:8000
#   API Docs:  http://localhost:8000/docs
#   MinIO:     http://localhost:9001
#   Flower:    http://localhost:5555
```

### Development

```bash
# Start backend services
docker compose up -d postgres redis minio

# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev    # http://localhost:5173
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://...` | Async PostgreSQL connection string |
| `DATABASE_URL_SYNC` | `postgresql://...` | Sync connection for Alembic migrations |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis for caching and SSE pub/sub |
| `CELERY_BROKER_URL` | `redis://localhost:6379/1` | Celery task broker |
| `CELERY_RESULT_BACKEND` | `redis://localhost:6379/2` | Celery result store |
| `JWT_SECRET_KEY` | (change in prod) | JWT signing key. Generate: `openssl rand -hex 32` |
| `S3_ENDPOINT_URL` | `http://localhost:9000` | MinIO/S3 endpoint |
| `S3_ACCESS_KEY` | `minioadmin` | S3 access key |
| `S3_SECRET_KEY` | `minioadmin` | S3 secret key |
| `S3_BUCKET_NAME` | `mixmodel-uploads` | Upload storage bucket |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `APP_ENV` | `development` | Environment: development, production, test |
| `VITE_API_URL` | `/api` | Frontend API base URL |

## API Documentation

Interactive API docs are available at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health check**: `GET /health` (includes dependency status)

## Project Structure

```
mmm-saas/
├── frontend/                    # React SPA
│   ├── src/
│   │   ├── components/          # UI components by domain
│   │   │   ├── layout/          # Sidebar, top bar
│   │   │   ├── upload/          # Upload wizard components
│   │   │   ├── model/           # Model config, progress
│   │   │   ├── results/         # Executive, Manager, Analyst views
│   │   │   └── shared/          # Button, Card, Modal, Badge, etc.
│   │   ├── pages/               # Route pages (Dashboard, Upload, ModelRun, Results)
│   │   ├── hooks/               # React Query hooks, custom hooks
│   │   ├── services/            # API client with auth interceptors
│   │   ├── store/               # Zustand stores (auth, dataset, model)
│   │   ├── types/               # TypeScript interfaces
│   │   └── lib/                 # Utilities (cn, formatCurrency, etc.)
│   ├── e2e/                     # Playwright E2E tests
│   ├── Dockerfile               # Multi-stage production build
│   └── nginx.conf               # SPA routing + API proxy
│
├── backend/                     # FastAPI application
│   ├── app/
│   │   ├── api/routes/          # Auth, upload, models, results, workspace
│   │   ├── core/                # Config, security (JWT), database
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── services/            # Business logic (storage, cache, validator, etc.)
│   │   ├── engine/              # PyMC-Marketing MMM engine
│   │   │   ├── base.py          # Abstract BaseMMM interface
│   │   │   ├── pymc_engine.py   # PyMC-Marketing implementation
│   │   │   └── types.py         # Engine data classes
│   │   └── tasks/               # Celery tasks (model fitting)
│   ├── alembic/                 # Database migrations
│   ├── Dockerfile
│   └── requirements.txt
│
├── tests/                       # Backend test suite
├── docker-compose.yml           # Full-stack orchestration
├── Makefile                     # Development commands
└── .env.example                 # Environment variable template
```

## Key Features

### Data Upload Wizard
Three-step wizard: Upload CSV -> Map Columns (auto-detected) -> Validate data quality.

### Bayesian MMM Engine
- **Adstock modeling**: Geometric or Weibull decay for carryover effects
- **Saturation modeling**: Logistic or Hill functions for diminishing returns
- **Quick mode**: 500 draws, 2 chains (~2-5 min)
- **Full mode**: 2000 draws, 4 chains (~10-30 min)
- Real-time progress via Server-Sent Events (SSE)

### Three Result Views
- **Executive**: Hero KPIs, revenue decomposition pie chart, AI-generated recommendations
- **Manager**: ROAS comparison bars, saturation analysis, adstock decay curves, waterfall chart
- **Analyst**: Posterior distributions, convergence diagnostics (R-hat, ESS), actual vs predicted with HDI bands

## Make Commands

```bash
make help              # Show all commands
make dev               # Start Docker services
make dev-full          # Start all services including frontend
make dev-down          # Stop services
make dev-logs          # Tail all logs
make frontend          # Start frontend dev server
make test              # Run all tests
make test-backend      # Run backend tests
make test-frontend     # Run frontend tests
make lint              # Lint all code
make format            # Format all code
make db-migrate msg="" # Create new Alembic migration
make db-upgrade        # Run pending migrations
```

## License

MIT
