.PHONY: help dev dev-full dev-down dev-logs db-migrate db-upgrade db-downgrade test test-backend test-frontend lint format flower seed

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development
dev: ## Start backend services with Docker Compose
	docker compose up -d
	@echo "Services starting..."
	@echo "  API:      http://localhost:8000"
	@echo "  Docs:     http://localhost:8000/docs"
	@echo "  MinIO:    http://localhost:9001"
	@echo "  Flower:   http://localhost:5555"
	@echo "  Frontend: http://localhost:5173 (run 'make frontend' separately)"

dev-full: ## Start all services including frontend
	docker compose up -d
	@echo "Services starting..."
	@echo "  Frontend:  http://localhost:3000"
	@echo "  API:       http://localhost:8000"
	@echo "  Docs:      http://localhost:8000/docs"
	@echo "  MinIO:     http://localhost:9001"
	@echo "  Flower:    http://localhost:5555"

dev-down: ## Stop all services
	docker compose down

dev-logs: ## Tail logs from all services
	docker compose logs -f

# Database
db-migrate: ## Create new Alembic migration (usage: make db-migrate msg="add users table")
	cd backend && alembic revision --autogenerate -m "$(msg)"

db-upgrade: ## Run all pending migrations
	cd backend && alembic upgrade head

db-downgrade: ## Rollback last migration
	cd backend && alembic downgrade -1

# Frontend
frontend: ## Start frontend dev server
	cd frontend && npm run dev

frontend-install: ## Install frontend dependencies
	cd frontend && npm install

frontend-build: ## Build frontend for production
	cd frontend && npm run build

# Testing
test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests
	cd backend && python -m pytest tests/ -v

test-frontend: ## Run frontend tests
	cd frontend && npm run test

# Code quality
lint: ## Lint all code
	cd backend && ruff check .
	cd frontend && npm run lint

format: ## Format all code
	cd backend && ruff format .
	cd frontend && npm run format

# Data
seed: ## Seed demo data (demo@mixmodel.app / demo123)
	cd backend && python -m scripts.seed

# Monitoring
flower: ## Open Celery Flower dashboard
	@echo "Flower: http://localhost:5555"

# E2E Testing
test-e2e: ## Run Playwright E2E tests
	cd frontend && npx playwright test

test-e2e-ui: ## Run Playwright E2E tests with UI
	cd frontend && npx playwright test --ui

# Docker
docker-build: ## Build all Docker images
	docker compose build

docker-up: ## Start all services
	docker compose up -d

docker-down: ## Stop all services
	docker compose down

docker-logs: ## Tail logs from all services
	docker compose logs -f
