"""Decide WHERE B-roll goes in a clip and WHAT each one shows.

Input: word-level transcript of one clip (clip seconds). Output: a list of cues
    {start, end, template, title, subtitle, value, icon, direction, left, right, winner, items, reason}

Uses Claude when ANTHROPIC credentials are available; otherwise a rule-based planner
so the pipeline still works offline.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Sequence

from . import icons

log = logging.getLogger(__name__)

TEMPLATES = ["concept", "stat", "compare", "steps", "trend", "keyword"]

# Timing rules (from what top clippers do; see README "Research")
MIN_DUR, MAX_DUR = 2.0, 4.0
LEAD_IN = 0.15          # start a hair before the word so the entry lands on it
MIN_GAP = 1.5           # speaker must be back on screen between cutaways
SECONDS_PER_CUE = 7.0   # density: roughly one B-roll every ~7 s
MAX_CUES = 6


def max_cues_for(duration: float) -> int:
    return max(1, min(MAX_CUES, round(duration / SECONDS_PER_CUE)))


def timed_lines(words: Sequence[Dict[str, Any]], max_words: int = 8) -> str:
    """Transcript as short phrases, each prefixed with its start second."""
    lines, cur, start = [], [], 0.0
    for w in words:
        if not cur:
            start = float(w["start"])
        cur.append(str(w["word"]).strip())
        if len(cur) >= max_words or re.search(r"[.!?؟]$", cur[-1]):
            lines.append(f"[{start:.1f}] {' '.join(cur)}")
            cur = []
    if cur:
        lines.append(f"[{start:.1f}] {' '.join(cur)}")
    return "\n".join(lines)


# ---------------------------------------------------------------- Claude planner
SYSTEM_PROMPT = """You are the B-roll editor of a short-form video studio. You add short ANIMATED explainer cutaways (motion graphics, not stock footage) to a vertical talking-head clip, to keep viewers watching.

An animated B-roll plays for 2-4 seconds while the speaker keeps talking. Because it is drawn, it can show things stock footage cannot: numbers, comparisons, steps, trends and abstract ideas. Use it where a viewer benefits from SEEING what is said:
- stat: the speaker says a number, percentage, amount, multiplier or ranking ("73% of people", "$10,000", "3x faster", "number one"). value = the number exactly as it should appear ("73%", "$10K", "3x"); title = what it measures.
- compare: two things are contrasted ("rent vs buy", "most people... but rich people...", "instead of X do Y"). left/right = short labels with icons; winner = the side the speaker favours, or "none".
- steps: a sequence or list of 2-4 items ("first..., then..., finally", "three things"). items = short labels with icons, in order.
- trend: something grows, drops, doubles, crashes. direction up/down; optional value.
- concept: one concrete thing or idea is introduced ("compound interest", "your morning routine", "the algorithm"). icon + title (+ optional short subtitle).
- keyword: one punchy word or phrase the speaker stresses, a hook or a verdict ("Consistency.", "Never.", "That's the secret"). Use sparingly.

Choose the moments with the most viral value: the ones that clarify, surprise or punctuate. Leave a moment uncovered rather than force a weak or generic visual.
Never cover: the speaker pointing at something visible ("look at this", "like this"), a joke whose payoff is the face, emotional personal moments, the first second, the last second.

Rules:
- start = the second where the line that names the subject begins (the phrase timestamp, or a little later inside the phrase). end - start is 2 to 4 seconds. Cutaways never overlap and leave at least 1.5 s of speaker between them.
- Text is SHORT and in the clip's own language (Arabic, French, Tunisian Darija, English...): title at most 5 words, labels at most 2 words, subtitle at most 5 words. Write Arabic in Arabic script. Never invent facts or numbers the speaker did not say.
- icon fields: an English icon name from this list where possible: {icons}. Pick the most literal icon.
- Unused fields: empty string, empty list, "none".
- reason: a few words on why this moment (for the editor's log)."""

CUE_SCHEMA = {
    "type": "object",
    "properties": {
        "cues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start": {"type": "number"},
                    "end": {"type": "number"},
                    "template": {"type": "string", "enum": TEMPLATES},
                    "title": {"type": "string"},
                    "subtitle": {"type": "string"},
                    "value": {"type": "string"},
                    "icon": {"type": "string"},
                    "direction": {"type": "string", "enum": ["up", "down", "none"]},
                    "left_label": {"type": "string"},
                    "left_icon": {"type": "string"},
                    "right_label": {"type": "string"},
                    "right_icon": {"type": "string"},
                    "winner": {"type": "string", "enum": ["left", "right", "none"]},
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {"label": {"type": "string"}, "icon": {"type": "string"}},
                            "required": ["label", "icon"],
                            "additionalProperties": False,
                        },
                    },
                    "reason": {"type": "string"},
                },
                "required": ["start", "end", "template", "title", "subtitle", "value", "icon", "direction",
                             "left_label", "left_icon", "right_label", "right_icon", "winner", "items", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["cues"],
    "additionalProperties": False,
}


def plan_with_claude(words, duration, style_id, max_cues, earliest, model=None) -> List[Dict[str, Any]]:
    import anthropic  # optional dependency

    client = anthropic.Anthropic()
    prompt = (
        f"Clip length: {duration:.1f} s. Animation style chosen by the user: {style_id}.\n"
        f"Return at most {max_cues} cutaways. None may start before {earliest:.1f} s or end after {max(0.0, duration - 1):.1f} s.\n\n"
        "Transcript, one phrase per line, prefixed with the second it starts at:\n" + timed_lines(words)
    )
    resp = client.beta.messages.create(
        model=model or os.environ.get("BROLL_MODEL", "claude-opus-5-5"),
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",  # if the model declines, the API retries on a fallback model
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": CUE_SCHEMA}},
        system=SYSTEM_PROMPT.replace("{icons}", ", ".join(icons.CURATED)),
        messages=[{"role": "user", "content": prompt}],
    )
    if resp.stop_reason == "refusal":
        raise RuntimeError("planner request was declined")
    text = next(b.text for b in resp.content if b.type == "text")
    return [_from_schema(c) for c in json.loads(text)["cues"]]


def _from_schema(c: Dict[str, Any]) -> Dict[str, Any]:
    cue = {k: c.get(k) for k in ("start", "end", "template", "title", "subtitle", "value", "icon", "reason")}
    if c.get("template") == "trend":
        cue["direction"] = "down" if c.get("direction") == "down" else "up"
    if c.get("template") == "compare":
        cue["left"] = {"label": c.get("left_label", ""), "icon": c.get("left_icon", "")}
        cue["right"] = {"label": c.get("right_label", ""), "icon": c.get("right_icon", "")}
        cue["winner"] = c.get("winner") if c.get("winner") in ("left", "right") else None
    if c.get("template") == "steps":
        cue["items"] = [dict(i) for i in c.get("items", [])][:4]
    return cue


# ---------------------------------------------------------------- offline planner
NUM_RE = re.compile(r"^[$€£]?\d[\d,.]*(%|k|m|x|K|M|X|٪)?$|^\d+(st|nd|rd|th)$")
COMPARE_WORDS = {"vs", "versus", "instead", "rather", "than", "but", "whereas", "contre", "plutôt", "mais", "بدل", "ولا", "لكن", "اما"}
STEP_WORDS = {"first", "second", "third", "then", "finally", "step", "steps", "premièrement", "ensuite", "enfin", "أولا", "ثانيا", "ثم"}
UP_WORDS = {"grow", "grows", "growth", "double", "doubled", "increase", "increased", "rise", "skyrocket", "boom", "up"}
DOWN_WORDS = {"drop", "dropped", "fall", "fell", "crash", "crashed", "decrease", "decline", "lose", "lost", "down"}
STOP = set("the a an and or of to in on for with is are was were be been it this that these those you your i we they he she my our their at by from as so just".split())


def plan_offline(words, duration, max_cues, earliest) -> List[Dict[str, Any]]:
    cands = []
    for i, w in enumerate(words):
        t = float(w["start"])
        if t < earliest or t > duration - 1 - MIN_DUR:
            continue
        raw = str(w["word"]).strip()
        tok = re.sub(r"[^\w$€£%٪.,]", "", raw).lower()
        nxt = [re.sub(r"[^\w]", "", str(x["word"])).lower() for x in words[i + 1:i + 5]]
        ctx = " ".join(str(x["word"]) for x in words[i + 1:i + 5])
        if NUM_RE.match(tok) or (tok.isdigit() and nxt and nxt[0] in {"percent", "%", "times", "million", "thousand", "billion", "dollars"}):
            val = raw.strip(".,")
            if nxt and nxt[0] in {"percent"}:
                val += "%"
            elif nxt and nxt[0] in {"times"}:
                val += "x"
            elif nxt and nxt[0] in {"million", "thousand", "billion"}:
                val += {"million": "M", "thousand": "K", "billion": "B"}[nxt[0]]
            unit = 1 if nxt and nxt[0] in {"percent", "times", "million", "thousand", "billion", "dollars"} else 0
            title = " ".join(str(x["word"]) for x in words[i + 1 + unit:i + 5 + unit])
            cands.append((3, {"start": t, "template": "stat", "value": val, "title": title, "reason": "number"}))
        elif tok in UP_WORDS or tok in DOWN_WORDS:
            cands.append((2, {"start": t, "template": "trend", "direction": "up" if tok in UP_WORDS else "down",
                              "title": " ".join(str(x["word"]) for x in words[max(0, i - 2):i + 2]), "reason": "trend"}))
        elif tok in {"vs", "versus"} and 0 < i < len(words) - 1:
            a, b = str(words[i - 1]["word"]).strip(".,"), str(words[i + 1]["word"]).strip(".,")
            cands.append((3, {"start": float(words[i - 1]["start"]), "template": "compare",
                              "left": {"label": a, "icon": icons.match_word(a) or "circle"},
                              "right": {"label": b, "icon": icons.match_word(b) or "circle"}, "winner": None, "reason": "comparison"}))
        else:
            ic = icons.match_word(tok) if tok not in STOP else None
            if ic:
                cands.append((1, {"start": t, "template": "concept", "icon": ic, "title": raw.strip(".,!?"), "reason": "concrete noun"}))
    cands.sort(key=lambda x: (-x[0], x[1]["start"]))
    chosen = []
    for _, c in cands:
        c["end"] = c["start"] + 3.0
        if all(c["start"] >= o["end"] + MIN_GAP or c["end"] + MIN_GAP <= o["start"] for o in chosen):
            chosen.append(c)
        if len(chosen) >= max_cues:
            break
    return chosen


# ---------------------------------------------------------------- validation
def sanitize(cues, duration, earliest, lead_in: float = LEAD_IN, min_gap: float = MIN_GAP) -> List[Dict[str, Any]]:
    """Clamp timings, enforce gaps, resolve icons, drop broken cues."""
    out = []
    for c in sorted(cues, key=lambda c: float(c.get("start", 0))):
        try:
            s, e = float(c["start"]), float(c["end"])
        except (KeyError, TypeError, ValueError):
            continue
        if c.get("template") not in TEMPLATES:
            continue
        s = max(earliest, s - lead_in)
        e = min(max(e, s + MIN_DUR), s + MAX_DUR, duration - 0.8)
        if e - s < MIN_DUR - 0.3:
            continue
        if out and s < out[-1]["end"] + min_gap:
            continue
        c = dict(c, start=round(s, 3), end=round(e, 3))
        for k in ("title", "subtitle", "value"):
            c[k] = str(c.get(k) or "").strip()
        c["icon"] = icons.resolve(c.get("icon")) if c.get("icon") else ""
        if c["template"] == "stat" and not re.search(r"\d", c["value"]):
            c["template"] = "concept"
        if c["template"] == "compare":
            for side in ("left", "right"):
                d = c.get(side) or {}
                c[side] = {"label": str(d.get("label", "")), "icon": icons.resolve(d.get("icon") or d.get("label"), "circle")}
            if not (c["left"]["label"] and c["right"]["label"]):
                continue
        if c["template"] == "steps":
            c["items"] = [{"label": str(i.get("label", "")), "icon": icons.resolve(i.get("icon") or i.get("label"), "circle-dot")}
                          for i in (c.get("items") or []) if i.get("label")][:4]
            if len(c["items"]) < 2:
                continue
        if c["template"] in ("concept", "keyword") and not c["title"]:
            continue
        if c["template"] == "concept" and not c["icon"]:
            c["icon"] = "sparkles"
        out.append(c)
    for i, c in enumerate(out):
        c["id"] = f"broll{i:02d}"
    return out


def plan(words: Sequence[Dict[str, Any]], duration: float, style_id: str = "flat-poster",
         max_cues: Optional[int] = None, earliest: float = 1.0, use_ai: Optional[bool] = None,
         model: Optional[str] = None) -> List[Dict[str, Any]]:
    """Plan B-roll cues for one clip. Falls back to the offline planner if Claude is unavailable."""
    words = [w for w in words if str(w.get("word", "")).strip()]
    mc = max_cues or max_cues_for(duration)
    raw = None
    if use_ai is not False and words:
        try:
            raw = plan_with_claude(words, duration, style_id, mc, earliest, model)
        except Exception as e:  # missing SDK/credentials, network, refusal...
            if use_ai:
                raise
            log.warning("Claude planner unavailable (%s); using offline planner", e)
    if raw is None:
        raw = plan_offline(words, duration, mc, earliest)
    return sanitize(raw, duration, earliest)[:mc]
