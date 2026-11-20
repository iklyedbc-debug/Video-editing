"""Procedural sound effects for B-roll entries (no sample files needed)."""
import numpy as np

SR = 48000


def _env(n, a=0.01, r=0.25):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / r)


def whoosh(dur=0.45, seed=0):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    # sweep a one-pole low-pass up then down
    out, y = np.zeros(n), 0.0
    cut = 0.02 + 0.5 * np.sin(np.linspace(0, np.pi, n)) ** 2
    for i in range(n):
        y += cut[i] * (noise[i] - y)
        out[i] = y
    return out * np.sin(np.linspace(0, np.pi, n)) ** 1.5 * 0.6


def pop(freq=520, dur=0.18):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + 1.6 * np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n, 0.002, 0.05) * 0.7


def chip(dur=0.28):
    """8-bit square arpeggio."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    notes = np.array([523.25, 659.25, 783.99, 1046.5])
    f = notes[np.minimum((t / (dur / 4)).astype(int), 3)]
    return np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * _env(n, 0.002, 0.2) * 0.25


def glitch(dur=0.25, seed=0):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    x = np.repeat(rng.uniform(-1, 1, n // 300 + 1), 300)[:n]
    return x * _env(n, 0.001, 0.08) * 0.35


def buzz(dur=0.35):
    """Neon tube strike."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sign(np.sin(2 * np.pi * 100 * t)) * 0.3 + np.sin(2 * np.pi * 200 * t) * 0.2
    gate = (np.random.default_rng(1).uniform(size=n // 800 + 1) > 0.35).repeat(800)[:n]
    return x * gate * _env(n, 0.003, 0.15) * 0.4


def mix(*xs):
    out = np.zeros(max(len(x) for x in xs))
    for x in xs:
        out[: len(x)] += x
    return out


def for_style(style: str, seed: int = 0):
    return {
        "9-bit-quest": lambda: chip(),
        "retro-console": lambda: chip(0.18) * 0.6,
        "golden-neon": lambda: buzz(),
        "glitch-hype": lambda: glitch(seed=seed),
        "pop-comic": lambda: mix(pop(380), whoosh(0.3, seed) * 0.5),
        "soft-3d": lambda: pop(700),
        "toy-bricks": lambda: mix(pop(900, 0.08), np.concatenate([np.zeros(2400), pop(1100, 0.08)])),
    }.get(style, lambda: whoosh(seed=seed))()


def track(style: str, starts, duration: float, gain: float = 0.5) -> np.ndarray:
    """Stereo float track of the whole clip with one SFX at each cue start."""
    n = int(duration * SR) + SR
    out = np.zeros(n)
    for i, s in enumerate(starts):
        fx = for_style(style, i) * gain
        a = int(max(0.0, s) * SR)
        b = min(n, a + len(fx))
        out[a:b] += fx[: b - a]
    return np.stack([out, out], axis=1).astype(np.float32)


def write_wav(path, data: np.ndarray):
    import wave
    pcm = (np.clip(data, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
