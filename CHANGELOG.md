# Changelog

All notable changes to the MixModel project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-02-10

### Sprint 1-10: MVP Foundation

#### Added - Authentication
- User registration with workspace creation
- JWT-based authentication (15-minute access tokens, 7-day refresh tokens)
- Token refresh endpoint with automatic rotation
- Rate limiting on auth endpoints (5/min login, 10/min refresh)
- `/auth/me` endpoint to fetch current user details

#### Added - Data Upload Pipeline
- Drag-and-drop CSV/Excel file upload (max 50 MB)
- Multi-encoding support (UTF-8, Latin-1, CP1252)
- File sanitization and CSV injection protection
- MinIO/S3 storage integration for raw and processed files
- Preview endpoint (first 10 rows)
- Column auto-detection using heuristics (date, target, media, controls)
- Interactive column mapping UI with drag-and-drop role assignment

#### Added - Data Validation
- Comprehensive validation with three severity levels:
  - **Errors**: Missing columns, parsing failures, negative spend, non-numeric data
  - **Warnings**: High null rates (>20%), low variance, date gaps, spend spikes
  - **Suggestions**: Log-transform recommendations, control variable hints
- Data quality summary (row count, date range, null percentages)
- Validation report stored in JSONB column

#### Added - Bayesian MMM Engine
- Abstract `BaseMMM` interface for pluggable engines
- PyMC-Marketing implementation with:
  - **Adstock models**: Geometric (exponential decay) and Weibull (flexible decay)
  - **Saturation models**: Logistic (s-curve) and Hill (diminishing returns)
  - Configurable priors (beta, gamma, normal distributions)
  - Quick mode (500 samples, 2 chains, ~2-5 min) and Full mode (2000 samples, 4 chains, ~10-30 min)
- Model serialization (pickle) and artifact storage in S3

#### Added - Real-Time Progress Tracking
- Redis pub/sub for progress updates
- Server-Sent Events (SSE) endpoint for streaming progress to frontend
- Progress stages: loading, preparing, tuning, sampling, extracting, done
- Keepalive ping every 15 seconds to prevent connection timeout

#### Added - Results Dashboard
- **Executive View**:
  - Total spend, total revenue, blended ROAS
  - Revenue decomposition pie chart (media vs baseline vs controls)
  - AI-generated recommendations (top 3 insights)
- **Manager View**:
  - ROAS comparison bar chart
  - Saturation curves (spend vs response) for each channel
  - Adstock decay curves (carryover effects)
  - Revenue waterfall chart (channel contributions)
- **Analyst View**:
  - Posterior distributions (mean, std, HDI) for all coefficients
  - Convergence diagnostics (R-hat, ESS bulk/tail)
  - Actual vs predicted plot with 94% HDI bands
  - Residual analysis

#### Added - Budget Optimizer
- Response curve-based budget allocation
- Constrained optimization (min/max per channel)
- Marginal ROAS calculation for each channel
- Predicted revenue and ROAS at optimized allocation

#### Added - Dashboard
- Workspace summary stats (total datasets, model runs, avg ROAS)
- Recent model runs list (last 5)
- Recent datasets list (last 5)
- AI-generated recommendations based on latest completed run

#### Added - Dataset Management
- List all datasets in workspace (sorted by creation date)
- Get dataset details (row count, date range, column mapping, validation status)
- Update column mapping
- Delete dataset (removes S3 files and database record)
- Cascade delete: deleting dataset deletes all associated model runs

#### Added - Model Run Management
- Create model run with configuration (mode, adstock/saturation types, priors)
- List model runs in workspace (sorted by creation date)
- Get model run details (status, progress, results)
- Get model results with Redis caching (1-hour TTL)
- Delete model run (removes S3 artifact and invalidates cache)

#### Added - Infrastructure
- Docker Compose setup with 7 services:
  - PostgreSQL 16 (persistent storage with JSONB)
  - Redis 7 (cache, pub/sub, Celery broker/backend)
  - MinIO (S3-compatible object storage)
  - FastAPI (async API server)
  - Celery Worker (model fitting tasks)
  - Flower (Celery monitoring dashboard)
  - Nginx (production frontend serving)
- Health check endpoint (`/health`) for all dependencies
- Alembic migrations for database schema versioning

### Sprint 11: Deployment Ready

#### Added
- Frontend Dockerfile with multi-stage build (Node.js build → Nginx serving)
- Nginx configuration for SPA routing (try_files fallback) and API proxy
- Environment variable validation on startup

#### Changed
- Auth endpoints now return user data in response (register, login)
- Alembic migration imports fixed for consistent table creation

### Sprint 12: Production Hardening

#### Added - Security
- Content-Security-Policy headers in production mode
- Security headers middleware (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS)
- Request ID middleware for distributed tracing

#### Added - Observability
- Sentry integration for both frontend and backend:
  - Unhandled exception capture
  - Performance traces (10% sample rate)
  - Breadcrumb tracking for API calls
- Structured JSON logging in production (`APP_ENV=production`)
- Request logging middleware (method, path, status, duration, request ID)

#### Added - Reliability
- Celery worker health check in `/health` endpoint
- Graceful Celery task timeout handling (30-minute soft timeout)
- Database composite indexes for common queries:
  - `(workspace_id, created_at DESC)` on `model_runs` table
  - `workspace_id` indexes on all tenant tables

#### Added - Testing
- Frontend test suite with 55 tests:
  - **Utils**: formatCurrency, formatPercent, formatDate, cn (Tailwind class merging)
  - **API**: apiClient interceptors, auth endpoints, dataset endpoints
  - **Stores**: authStore, datasetStore, modelStore (Zustand)
- Vitest configuration with happy-dom environment
- Mock service worker (MSW) for API mocking

#### Changed
- Improved error messages in validation checks
- Enhanced logging for CSV injection detection (warn only, don't block)

### Sprint 13: CI/CD & Polish

#### Added - CI/CD
- GitHub Actions workflow with 4 jobs:
  - Backend lint (Ruff) and tests (pytest)
  - Frontend lint (ESLint) and tests (Vitest)
  - Backend Docker build
  - Frontend Docker build
- Workflow triggers: push to main, pull requests, manual dispatch
- Docker layer caching for faster builds

#### Added - Accessibility
- ARIA labels on interactive elements (buttons, inputs, links)
- Keyboard navigation support (Tab, Enter, Escape)
- Focus indicators on all focusable elements
- Semantic HTML (nav, main, section, article)
- Alt text on images and icons

#### Added - Documentation
- `ARCHITECTURE.md`: Technical architecture deep-dive (system overview, backend structure, database schema, auth flow, MMM engine, caching)
- `DEPLOYMENT.md`: Production deployment guide (prerequisites, environment variables, Docker Compose setup, security checklist, scaling, monitoring, troubleshooting)
- `CHANGELOG.md`: Version history with sprint-by-sprint feature breakdown

#### Added - Dependency Management
- Dependabot configuration for automated dependency updates:
  - Weekly checks for npm (frontend)
  - Weekly checks for pip (backend)
  - Weekly checks for Docker base images
  - Weekly checks for GitHub Actions

#### Changed
- Improved README.md with clearer quick start instructions
- Enhanced API documentation with more examples

---

## [Unreleased]

### Planned Features
- Multi-user workspaces with role-based access control
- Dataset versioning and lineage tracking
- Custom prior distributions via UI
- Model comparison (A/B testing)
- Automated reporting (PDF export)
- Slack/email notifications for completed runs
- Advanced budgeting with constraints (spend floors/ceilings, channel grouping)
- Time-varying coefficients for seasonality
- Geo-level modeling (market-level MMM)

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 0.1.0 | 2026-02-10 | Initial MVP release with full MMM pipeline |

---

## Contributors

- David Gabor - Lead Developer
- Claude Opus 4.6 - AI Pair Programmer

---

## License

MIT License - See LICENSE file for details
