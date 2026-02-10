import logging
import time
import uuid as uuid_lib

import sqlalchemy as sa
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.routes import auth, models, results, upload, workspace
from app.core.config import get_settings

settings = get_settings()

# Initialize Sentry
if settings.sentry_dsn:
    import sentry_sdk
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        traces_sample_rate=0.1 if settings.app_env == "production" else 1.0,
        profiles_sample_rate=0.1 if settings.app_env == "production" else 0,
    )

# Configure structured logging
if settings.app_env == "production":
    from pythonjsonlogger import jsonlogger
    handler = logging.StreamHandler()
    handler.setFormatter(jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={"asctime": "timestamp", "levelname": "level"},
    ))
    logging.root.handlers = [handler]
    logging.root.setLevel(logging.INFO)
else:
    logging.basicConfig(
        level=logging.DEBUG if settings.app_debug else logging.INFO,
        format="%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
logger = logging.getLogger("mixmodel")

limiter = Limiter(key_func=get_remote_address, enabled=settings.app_env != "test")

app = FastAPI(
    title="MixModel API",
    description="Bayesian Marketing Mix Modeling SaaS Platform",
    version="0.1.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Error Handling Middleware ---

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return consistent error format for validation errors."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Validation error",
            "errors": [
                {
                    "field": ".".join(str(loc) for loc in err.get("loc", [])),
                    "message": err.get("msg", ""),
                    "type": err.get("type", ""),
                }
                for err in exc.errors()
            ],
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return a generic 500 response."""
    request_id = getattr(request.state, 'request_id', '-')
    logger.exception(f"[{request_id}] Unhandled exception on {request.method} {request.url.path}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error", "request_id": request_id},
    )


# --- Middleware (Starlette processes in reverse registration order) ---
# Register innermost first, outermost last:
#   1. Security headers (innermost - runs last on request)
#   2. Request logging (middle - needs request_id set)
#   3. Request ID (outermost - runs first on request, sets request_id)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if settings.app_env == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "connect-src 'self'; "
            "font-src 'self'; "
            "frame-ancestors 'none'"
        )
    return response


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000
    request_id = getattr(request.state, 'request_id', '-')
    logger.info(
        f"[{request_id}] {request.method} {request.url.path} -> {response.status_code} ({duration_ms:.0f}ms)"
    )
    return response


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid_lib.uuid4()))
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# --- Routes ---

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(upload.router, prefix=settings.api_prefix)
app.include_router(models.router, prefix=settings.api_prefix)
app.include_router(results.router, prefix=settings.api_prefix)
app.include_router(workspace.router, prefix=settings.api_prefix)


@app.on_event("startup")
async def startup_ensure_storage():
    """Create the S3/MinIO bucket on startup in development mode."""
    if settings.app_env == "development":
        try:
            from app.services.storage import StorageService

            StorageService()  # constructor calls _ensure_bucket
            logger.info("Storage bucket verified/created on startup")
        except Exception:
            logger.warning("Could not verify/create S3 bucket on startup - MinIO may not be ready")


@app.on_event("startup")
async def startup_check_jwt_secret():
    """Warn or raise if JWT secret is the insecure default."""
    if settings.jwt_secret_key == "change-me-in-production":
        if settings.app_env == "production":
            raise RuntimeError(
                "FATAL: JWT_SECRET_KEY is set to the default value. "
                "Set a secure random secret via environment variable."
            )
        else:
            logger.warning(
                "JWT_SECRET_KEY is using the default value. "
                "Set a secure secret before deploying to production."
            )


@app.get("/health")
async def health():
    checks = {}

    # Check PostgreSQL
    try:
        from app.core.database import engine
        async with engine.connect() as conn:
            await conn.execute(sa.text("SELECT 1"))
        checks["database"] = "healthy"
    except Exception as e:
        logger.warning(f"Health check database failed: {e}")
        checks["database"] = f"unhealthy: {e}" if settings.app_env == "development" else "unhealthy"

    # Check Redis
    try:
        import redis as redis_lib
        r = redis_lib.from_url(settings.redis_url, decode_responses=True)
        r.ping()
        r.close()
        checks["redis"] = "healthy"
    except Exception as e:
        logger.warning(f"Health check redis failed: {e}")
        checks["redis"] = f"unhealthy: {e}" if settings.app_env == "development" else "unhealthy"

    # Check S3/MinIO
    try:
        import boto3
        s3 = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
        )
        s3.list_buckets()
        checks["storage"] = "healthy"
    except Exception as e:
        logger.warning(f"Health check storage failed: {e}")
        checks["storage"] = f"unhealthy: {e}" if settings.app_env == "development" else "unhealthy"

    # Check Celery
    try:
        from app.tasks.celery_app import celery_app
        celery_app.control.ping(timeout=2.0)
        checks["celery"] = "healthy"
    except Exception as e:
        logger.warning(f"Health check celery failed: {e}")
        checks["celery"] = "unhealthy"

    all_healthy = all(v == "healthy" for v in checks.values())
    overall = "healthy" if all_healthy else "degraded"

    return {"status": overall, "version": "0.1.0", "checks": checks}
