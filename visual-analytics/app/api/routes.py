from fastapi import APIRouter, BackgroundTasks, Depends
import asyncio

from app.services.orchestrator import run_full_pipeline
from app.core.security import verify_internal_api_key

router = APIRouter()


def _run_pipeline_sync():
    """
    Sync wrapper for async pipeline.
    Safe to run inside BackgroundTasks.
    """
    asyncio.run(run_full_pipeline())


@router.post(
    "/visual/reanalyze/all",
    dependencies=[Depends(verify_internal_api_key)]
)
def run_full_visual_analytics(background_tasks: BackgroundTasks):
    background_tasks.add_task(_run_pipeline_sync)

    return {
        "status": "started",
        "message": "Visual analytics pipeline started successfully"
    }
