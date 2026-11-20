"""Render cues with the engine and composite them onto the clip with ffmpeg."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any, Dict, List

ENGINE = Path(__file__).resolve().parent.parent / "engine"


def probe(path: str) -> Dict[str, Any]:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration",
                          "-of", "json", path], capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    return {"width": int(v["width"]), "height": int(v["height"]), "duration": float(j["format"]["duration"]),
            "has_audio": any(s["codec_type"] == "audio" for s in j["streams"])}


def broll_size(layout: str, w: int, h: int):
    """Size the engine should draw at for a clip of w x h."""
    even = lambda x: int(x) // 2 * 2
    if layout == "full":
        return w, h
    if layout == "pip":
        s = even(w * 0.86)
        return s, s
    return w, even(h / 2)  # split


def render_cues(cues: List[Dict[str, Any]], style: str, layout: str, size, work: Path, fps: int = 30) -> List[Dict[str, Any]]:
    job = {"style": style, "layout": layout, "width": size[0], "height": size[1], "fps": fps,
           "outDir": str(work), "concurrency": 3, "cues": cues}
    jp = work / "job.json"
    jp.write_text(json.dumps(job, ensure_ascii=False))
    res = subprocess.run(["node", str(ENGINE / "render_cues.mjs"), str(jp)], capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError("B-roll render failed:\n" + res.stderr[-3000:])
    return json.loads(res.stdout.strip().splitlines()[-1])["clips"]


def composite(clip: str, rendered: List[Dict[str, Any]], layout: str, out: str, sfx_wav: str | None = None,
              face_y: float = 0.4, crf: int = 18):
    """Overlay rendered B-roll (with alpha) onto the clip at its cue times. Audio passes through (+ SFX)."""
    info = probe(clip)
    W, H = info["width"], info["height"]
    bw, bh = broll_size(layout, W, H)
    inputs = ["-i", clip]
    for r in rendered:
        inputs += ["-i", r["path"]]
    if sfx_wav:
        inputs += ["-i", sfx_wav]
    f, cur = [], "[0:v]"
    if layout == "split" and rendered:
        # while a cutaway is up, the speaker is re-framed into the bottom half (face kept in view)
        y0 = int(min(max(face_y * H - bh / 2, 0), H - bh))
        win = "+".join(f"between(t,{r['start']:.3f},{r['end']:.3f})" for r in rendered)
        f.append(f"[0:v]split=2[base][alt]")
        f.append(f"[alt]crop={W}:{bh}:0:{y0}[spk]")
        f.append(f"[base][spk]overlay=0:{H - bh}:enable='{win}'[v0]")
        cur = "[v0]"
    x = (W - bw) // 2
    y = 0 if layout != "pip" else int(H * 0.1)
    for i, r in enumerate(rendered, start=1):
        f.append(f"[{i}:v]setpts=PTS-STARTPTS+{r['start']:.3f}/TB,format=rgba[b{i}]")
        f.append(f"{cur}[b{i}]overlay={x}:{y}:eof_action=pass:format=auto[v{i}]")
        cur = f"[v{i}]"
    f.append(f"{cur}format=yuv420p[vout]")
    maps = ["-map", "[vout]"]
    if sfx_wav and info["has_audio"]:
        k = len(rendered) + 1
        f.append(f"[0:a][{k}:a]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]")
        maps += ["-map", "[aout]", "-c:a", "aac", "-b:a", "192k"]
    elif sfx_wav:
        k = len(rendered) + 1
        maps += ["-map", f"{k}:a", "-c:a", "aac", "-b:a", "192k", "-shortest"]
    elif info["has_audio"]:
        maps += ["-map", "0:a", "-c:a", "copy"]
    cmd = ["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(f), *maps,
           "-c:v", "libx264", "-preset", "medium", "-crf", str(crf), "-movflags", "+faststart", out]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError("ffmpeg composite failed:\n" + res.stderr[-3000:])
    return out
