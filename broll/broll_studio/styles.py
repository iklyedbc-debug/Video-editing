"""The B-roll animation styles offered to users (mirrors engine/js/styles/all.js)."""

STYLES = [
    {"id": "9-bit-quest", "name": "9-Bit Quest", "tagline": "Retro RPG pixels, dialog-box typing, chip SFX",
     "best_for": ["gaming", "tech", "self-improvement 'level up'", "storytime"]},
    {"id": "chalk-doodle", "name": "Chalk Doodle", "tagline": "Hand-drawn chalk on a slate board",
     "best_for": ["education", "explainers", "science", "language"]},
    {"id": "golden-neon", "name": "Golden Neon", "tagline": "Flickering gold neon signs on a dark wall",
     "best_for": ["luxury", "money", "motivation", "nightlife"]},
    {"id": "retro-console", "name": "Retro Console", "tagline": "Green-phosphor CRT terminal with typing cursor",
     "best_for": ["tech", "AI", "coding", "hacking", "crypto"]},
    {"id": "pop-comic", "name": "Pop Comic", "tagline": "POW bursts, halftone dots and bold ink",
     "best_for": ["entertainment", "hot takes", "storytime", "sports"]},
    {"id": "flat-poster", "name": "Flat Poster", "tagline": "Bold flat-colour poster with sweeping colour wipes",
     "best_for": ["business", "marketing", "news", "productivity"]},
    {"id": "line-diagram", "name": "Line Diagram", "tagline": "Technical line art with callouts and dimensions",
     "best_for": ["engineering", "how it works", "product breakdowns", "finance"]},
    {"id": "cinematic-3d", "name": "Cinematic 3D", "tagline": "Extruded gold type, light beams, slow push-in",
     "best_for": ["documentary", "history", "big reveals", "podcasts"]},
    {"id": "toy-bricks", "name": "Toy Bricks", "tagline": "Everything builds itself from plastic bricks",
     "best_for": ["kids", "building/startups", "step-by-step", "fun facts"]},
    {"id": "soft-3d", "name": "Soft 3D", "tagline": "Pastel clay icons with springy bounces",
     "best_for": ["lifestyle", "wellness", "apps", "beauty", "parenting"]},
    {"id": "paper-cutout", "name": "Paper Cutout", "tagline": "Stop-motion paper scraps on kraft (bonus)",
     "best_for": ["DIY", "storytelling", "food", "travel"]},
    {"id": "glitch-hype", "name": "Glitch Hype", "tagline": "RGB-split glitches and scrambled text (bonus)",
     "best_for": ["tech", "gaming", "crypto", "shock facts"]},
]
STYLE_IDS = {s["id"] for s in STYLES}

LAYOUTS = {
    "split": "B-roll fills the top half, the speaker moves to the bottom half (the classic viral 9:16 look)",
    "full": "Full-screen cutaway; the voice keeps playing underneath",
    "pip": "A rounded card pops in over the top of the speaker",
}
