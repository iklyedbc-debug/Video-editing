"""CLI:  python -m broll_studio clip.mp4 -o out.mp4 --style chalk-doodle --words words.json

  --styles            list styles and exit
  --plan-only         print the planned cues as JSON (no render)
  --cues cues.json    skip planning and use these cues (e.g. edited by the user in your UI)
"""
import argparse
import json
import sys

from . import compose, pipeline, planner
from .styles import LAYOUTS, STYLES


def main(argv=None):
    ap = argparse.ArgumentParser(prog="broll_studio", description="Add animated B-roll to a talking-head clip")
    ap.add_argument("clip", nargs="?")
    ap.add_argument("-o", "--out", default="out_broll.mp4")
    ap.add_argument("--style", default="flat-poster")
    ap.add_argument("--layout", default="split", choices=list(LAYOUTS))
    ap.add_argument("--words", help="word-timing JSON for this clip (otherwise faster-whisper transcribes it)")
    ap.add_argument("--cues", help="use these cues instead of planning")
    ap.add_argument("--max-cues", type=int)
    ap.add_argument("--face-y", type=float, default=0.4, help="face height in the clip, 0=top 1=bottom (split layout)")
    ap.add_argument("--no-sound", action="store_true")
    ap.add_argument("--offline", action="store_true", help="never call Claude; rule-based planner")
    ap.add_argument("--plan-only", action="store_true")
    ap.add_argument("--styles", action="store_true")
    a = ap.parse_args(argv)
    if a.styles:
        for s in STYLES:
            print(f"{s['id']:15} {s['name']:15} {s['tagline']}")
        return 0
    if not a.clip:
        ap.error("clip is required")
    words = pipeline.load_words(a.words) if a.words else None
    use_ai = False if a.offline else None
    if a.plan_only:
        info = compose.probe(a.clip)
        words = words if words is not None else pipeline.transcribe(a.clip)
        print(json.dumps(planner.plan(words, info["duration"], a.style, a.max_cues, use_ai=use_ai), ensure_ascii=False, indent=2))
        return 0
    cues = json.load(open(a.cues)) if a.cues else None
    rep = pipeline.add_broll(a.clip, a.out, a.style, a.layout, words=words, cues=cues, sound=not a.no_sound,
                             face_y=a.face_y, max_cues=a.max_cues, use_ai=use_ai)
    print(json.dumps(rep, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
