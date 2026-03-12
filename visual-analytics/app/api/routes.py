import json
import asyncio
from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import List, Dict
from sse_starlette.sse import EventSourceResponse
from app.core.security import verify_internal_api_key
from app.services.node_pipeline import run_node_pipeline

router = APIRouter()

# Store queues per transaction
event_streams: Dict[str, asyncio.Queue] = {}

TERMINAL_EVENTS = {"unsupervised_completed", "error", "unsupervised_failed"}


class NodePayload(BaseModel):
    nodeId: int
    role: str


class VisualReanalyzeRequest(BaseModel):
    trigger: str
    transactionId: str
    nodes: List[NodePayload]


@router.post(
    "/visual/reanalyze/nodes",
    dependencies=[Depends(verify_internal_api_key)]
)
async def reanalyze_nodes(
    request: VisualReanalyzeRequest,
    background_tasks: BackgroundTasks
):
    # Always create a fresh queue BEFORE starting the background task
    queue = asyncio.Queue()
    event_streams[request.transactionId] = queue

    background_tasks.add_task(
        run_node_pipeline,
        request.nodes,
        queue
    )

    return {
        "status": "started",
        "transactionId": request.transactionId,
        "nodes": [n.nodeId for n in request.nodes]
    }


@router.get("/visual/stream/unsupervised")
async def stream_unsupervised(transactionId: str, nodeId: int):
    """
    SSE endpoint. The frontend must call this BEFORE or immediately after
    POST /visual/reanalyze/nodes to avoid missing early events.
    """
    queue = event_streams.get(transactionId)

    if queue is None:
        # Queue doesn't exist yet — wait briefly for it to be registered
        # (handles slight timing differences between POST and GET)
        for _ in range(20):  # wait up to 2s
            await asyncio.sleep(0.1)
            queue = event_streams.get(transactionId)
            if queue is not None:
                break

    if queue is None:
        # Still nothing — create a queue so the pipeline can be triggered
        # separately (e.g. from visualAnalyticsService.triggerVisualMlPipeline)
        queue = asyncio.Queue()
        event_streams[transactionId] = queue

    async def event_generator():
        try:
            while True:
                try:
                    # Timeout prevents hanging forever if pipeline never sends terminal event
                    event = await asyncio.wait_for(queue.get(), timeout=60.0)
                except asyncio.TimeoutError:
                    yield {
                        "event": "error",
                        "data": json.dumps({"message": "Pipeline timeout"})
                    }
                    break

                stage = event.get("stage", "message")
                data = event.get("data", {})

                # Skip events with empty/useless data
                if not data or data == {"message": ""}:
                    continue

                yield {
                    "event": stage,          # named SSE event → triggers addEventListener
                    "data": json.dumps(data)
                }

                if stage in TERMINAL_EVENTS:
                    break

        except asyncio.CancelledError:
            print(f"SSE client disconnected: {transactionId}")
        finally:
            # Clean up queue after stream ends
            event_streams.pop(transactionId, None)

    return EventSourceResponse(
        event_generator(),
        ping=10,
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",   # critical for nginx proxies
        }
    )