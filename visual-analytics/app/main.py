# app/main.py
from fastapi import FastAPI
from app.api.routes import router
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(
    title="Visual Analytics Service",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://13.60.91.248:8082","http://13.48.249.157:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# All API routes
app.include_router(router, prefix="/visual-analytics/api")


@app.get("/health")
def health():
    return {"status": "ok"}