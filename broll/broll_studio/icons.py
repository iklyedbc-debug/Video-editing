"""Icon vocabulary shared with the engine (lucide, ISC licence)."""
import json
import re
from functools import lru_cache
from pathlib import Path

ICONS_JS = Path(__file__).resolve().parent.parent / "engine" / "assets" / "icons.js"

# A curated short list the planner chooses from (any lucide name also works).
CURATED = """
rocket target trophy crown flame zap sparkles star heart brain lightbulb puzzle key lock shield shield-check
dollar-sign piggy-bank wallet banknote coins credit-card chart-line trending-up trending-down chart-bar percent calculator
briefcase building building-2 store shopping-cart shopping-bag gift package truck factory handshake users user user-check
smartphone laptop monitor tv camera video mic headphones music wifi globe cloud database server cpu bot code terminal
mail message-circle phone bell calendar clock timer hourglass alarm-clock map map-pin plane car bike train ship house
book-open graduation-cap school pencil pen-tool notebook-pen file-text clipboard-list list-checks check-circle x-circle
circle-alert triangle-alert ban thumbs-up thumbs-down eye search magnet anchor compass mountain sun moon droplet leaf
tree-pine flower apple coffee pizza utensils dumbbell activity heart-pulse pill stethoscope baby dog cat fish
gamepad-2 dice-5 film clapperboard palette brush scissors hammer wrench settings gauge battery-charging plug
recycle scale gavel landmark flag megaphone newspaper hash at-sign link share-2 repeat refresh-cw infinity
arrow-up-right arrow-down-right volume-x volume-2 hand-coins badge-percent receipt ticket gem medal swords skull ghost
""".split()


ALIASES = {"home": "house", "money": "banknote", "cash": "banknote", "chart": "chart-line", "growth": "trending-up",
           "idea": "lightbulb", "time": "clock", "phone": "smartphone", "car": "car", "people": "users", "person": "user"}


@lru_cache(maxsize=1)
def _data():
    try:
        txt = ICONS_JS.read_text()
        return json.loads(txt[txt.index("=") + 1: txt.rstrip().rindex(";")])
    except Exception:
        return {"icons": {}, "tags": {}}


def resolve(name: str, default: str = "sparkles") -> str:
    """Map any free-text icon name to a real lucide icon id (same rules as the engine)."""
    d = _data()
    if not name:
        return default
    n = re.sub(r"[\s_]+", "-", str(name).strip().lower())
    n = ALIASES.get(n, n)
    if n in d["icons"]:
        return n
    words = [w for w in n.split("-") if w]
    best, score = None, 0
    for key in d["icons"]:
        tags = d["tags"].get(key, [])
        s = sum(5 if key == w else 3 if w in key.split("-") else 2 if w in tags else 0 for w in words)
        if s > score or (s == score and s > 0 and len(key) < len(best)):
            best, score = key, s
    return best or default


def match_word(word: str):
    """Best icon for a single spoken word, or None (used by the offline planner)."""
    d = _data()
    w = re.sub(r"[^a-z0-9]", "", word.lower())
    if len(w) < 3:
        return None
    if w in d["icons"]:
        return w
    if w.endswith("s") and w[:-1] in d["icons"]:
        return w[:-1]
    for key, tags in d["tags"].items():
        if w in tags and key in CURATED:
            return key
    return None
