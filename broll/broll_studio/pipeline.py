"""One call to add animated B-roll to a finished clip."""
from __future__ import annotations

import json
import shutil
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from . import compose, planner, sfx
from .styles import LAYOUTS, STYLE_IDS


def load_words(path: str) -> List[Dict[str, Any]]:
    """Accepts [{word,start,end}], {"words": [...]}, or whisper-style {"segments": [{"words": [...]}]}."""
    data = json.loads(Path(path).read_text())
    if isinstance(data, dict) and "words" in data:
        data = data["words"]
    elif isinstance(data, dict) and "segments" in data:
        data = [w for s in data["segments"] for w in s.get("words", [])]
    return [{"word": w.get("word", w.get("text", "")), "start": float(w["start"]), "end": float(w.get("end", w["start"]))} for w in data]


def transcribe(clip: str, language: Optional[str] = None) -> List[Dict[str, Any]]:
    """Word timings with faster-whisper (optional dependency). Most clipping pipelines already have these."""
    from faster_whisper import WhisperModel  # pip install faster-whisper
    model = WhisperModel("small", compute_type="int8")
    segs, _ = model.transcribe(clip, word_timestamps=True, language=language)
    return [{"word": w.word, "start": w.start, "end": w.end} for s in segs for w in s.words]


def add_broll(clip: str, out: str, style: str = "flat-poster", layout: str = "split",
              words: Optional[Sequence[Dict[str, Any]]] = None, cues: Optional[List[Dict[str, Any]]] = None,
              sound: bool = True, face_y: float = 0.4, max_cues: Optional[int] = None,
              use_ai: Optional[bool] = None, keep_work: bool = False) -> Dict[str, Any]:
    """Plan (unless cues are given), render and composite B-roll. Returns a report with the cues used."""
    if style not in STYLE_IDS:
        raise ValueError(f"unknown style {style!r}; choose from {sorted(STYLE_IDS)}")
    if layout not in LAYOUTS:
        raise ValueError(f"unknown layout {layout!r}; choose from {list(LAYOUTS)}")
    t0 = time.time()
    info = compose.probe(clip)
    if cues is None:
        if words is None:
            words = transcribe(clip)
        cues = planner.plan(words, info["duration"], style, max_cues=max_cues, use_ai=use_ai)
    else:
        cues = planner.sanitize(cues, info["duration"], 0.0, lead_in=0.0, min_gap=0.1)  # user-edited: trust timings
    if not cues:
        shutil.copyfile(clip, out)
        return {"output": out, "cues": [], "note": "no moment needed B-roll", "seconds": time.time() - t0}
    work = Path(tempfile.mkdtemp(prefix="broll_"))
    try:
        size = compose.broll_size(layout, info["width"], info["height"])
        rendered = compose.render_cues(cues, style, layout, size, work)
        for r, c in zip(rendered, cues):
            c["end"] = r["end"]
        wav = None
        if sound:
            wav = str(work / "sfx.wav")
            sfx.write_wav(wav, sfx.track(style, [c["start"] for c in cues], info["duration"]))
        compose.composite(clip, rendered, layout, out, wav, face_y=face_y)
    finally:
        if not keep_work:
            shutil.rmtree(work, ignore_errors=True)
    return {"output": out, "style": style, "layout": layout, "cues": cues, "seconds": round(time.time() - t0, 1)}
