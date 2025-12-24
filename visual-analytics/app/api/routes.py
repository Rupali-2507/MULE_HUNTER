from fastapi import APIRouter, BackgroundTasks, Depends
from app.services.orchestrator import run_full_pipeline
from app.core.security import verify_internal_api_key

router = APIRouter()

@router.post(
    "/visual/reanalyze/all",
    dependencies=[Depends(verify_internal_api_key)]
)
def run_full_visual_analytics(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_full_pipeline)
    return {
        "status": "started",
        "message": "Visual analytics pipeline started successfully"
    }
