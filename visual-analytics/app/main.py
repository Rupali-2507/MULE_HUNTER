# app/main.py
from fastapi import FastAPI
from app.api.routes import router

app = FastAPI(
    title="Visual Analytics Service",
    version="1.0.0"
)

# All API routes
app.include_router(router, prefix="/visual-analytics/api")


@app.get("/health")
def health():
    return {"status": "ok"}
