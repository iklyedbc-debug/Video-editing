"""FastAPI router to mount in the clipping-studio backend (optional: pip install fastapi uvicorn).

    from broll_studio.api import router
    app.include_router(router, prefix="/broll")

Endpoints
    GET  /broll/styles                 -> style + layout catalogue for the picker UI
    GET  /broll/engine/...             -> the engine page (live style previews in the UI)
    POST /broll/plan   {clip_path, words?, style, max_cues?}           -> cues (editable in the UI)
    POST /broll/apply  {clip_path, out_path, style, layout, words?, cues?, sound?, face_y?} -> report

Run standalone for a demo:  uvicorn broll_studio.api:app --port 8765
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import compose, pipeline, planner
from .compose import ENGINE
from .styles import LAYOUTS, STYLES

router = APIRouter()


class PlanReq(BaseModel):
    clip_path: str
    words: Optional[List[Dict[str, Any]]] = None
    style: str = "flat-poster"
    max_cues: Optional[int] = None


class ApplyReq(PlanReq):
    out_path: str
    layout: str = "split"
    cues: Optional[List[Dict[str, Any]]] = None
    sound: bool = True
    face_y: float = 0.4


@router.get("/styles")
def styles():
    return {"styles": STYLES, "layouts": [{"id": k, "description": v} for k, v in LAYOUTS.items()]}


@router.post("/plan")
async def plan(req: PlanReq):
    info = compose.probe(req.clip_path)
    words = req.words if req.words is not None else await run_in_threadpool(pipeline.transcribe, req.clip_path)
    cues = await run_in_threadpool(planner.plan, words, info["duration"], req.style, req.max_cues)
    return {"duration": info["duration"], "cues": cues}


@router.post("/apply")
async def apply(req: ApplyReq):
    try:
        return await run_in_threadpool(pipeline.add_broll, req.clip_path, req.out_path, req.style, req.layout,
                                       req.words, req.cues, req.sound, req.face_y, req.max_cues)
    except ValueError as e:
        raise HTTPException(400, str(e))


app = FastAPI(title="B-roll studio")
app.include_router(router, prefix="/broll")
app.mount("/broll/engine", StaticFiles(directory=str(ENGINE)), name="engine")
app.mount("/engine", StaticFiles(directory=str(ENGINE)), name="engine-ui")  # ui/ uses ../engine/
app.mount("/ui", StaticFiles(directory=str(ENGINE.parent / "ui"), html=True), name="ui")
