from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.routes import auth, upload, models, results, workspace

settings = get_settings()

app = FastAPI(
    title="MixModel API",
    description="Bayesian Marketing Mix Modeling SaaS Platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(upload.router, prefix=settings.api_prefix)
app.include_router(models.router, prefix=settings.api_prefix)
app.include_router(results.router, prefix=settings.api_prefix)
app.include_router(workspace.router, prefix=settings.api_prefix)


@app.get("/health")
async def health():
    return {"status": "healthy", "version": "0.1.0"}
