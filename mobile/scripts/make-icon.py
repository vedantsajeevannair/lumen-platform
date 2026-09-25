"""Draw the LUMEN app icon.

The mark is a camera viewfinder closing on a pothole: four corner brackets
around an irregular amber shape. It says what the product does — a photograph
being read for damage — in a form that survives being 48 pixels wide, which a
literal illustration of a road would not.

Colours are the ones the app already uses: the indigo is the adaptive-icon
background that was already declared, and the amber is the SIGNIFICANT
severity band from the map legend, so the icon belongs to the same system as
the interface behind it.

Generated rather than hand-drawn so the three sizes cannot drift apart, and so
a colour change is one edit rather than three exports.

    python3 scripts/make-icon.py
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets"

INDIGO_TOP = (30, 42, 120)
INDIGO_BOTTOM = (14, 22, 74)
WHITE = (255, 255, 255)
AMBER = (245, 158, 11)
AMBER_DEEP = (180, 83, 9)

# A pothole is not an ellipse, and it is not symmetric either. These are radius
# multipliers around a circle — fixed rather than random so every regeneration
# is identical, and deliberately lopsided so the shape reads as a broken edge
# rather than a lozenge.
BLOB = [
    1.14, 1.05, 0.86, 0.79, 0.88, 1.02, 1.16, 1.21,
    1.09, 0.91, 0.80, 0.84, 0.97, 1.11, 1.18, 1.08,
]
# The inner core has its own outline; reusing the outer one would make it look
# like the same shape scaled, which no real pothole does.
CORE = [
    1.06, 1.14, 1.02, 0.85, 0.78, 0.86, 1.00, 1.12,
    1.17, 1.04, 0.88, 0.81, 0.90, 1.03, 1.10, 0.98,
]

# Everything is drawn at this multiple and scaled down, which is what gives the
# curves and the bracket caps clean edges. Pillow has no antialiased polygon.
SS = 4


def gradient(size: int) -> Image.Image:
    """Vertical indigo wash. Flat colour reads as a placeholder; this does not."""
    img = Image.new("RGB", (1, size))
    px = img.load()
    for y in range(size):
        t = y / max(size - 1, 1)
        px[0, y] = tuple(
            round(a + (b - a) * t) for a, b in zip(INDIGO_TOP, INDIGO_BOTTOM)
        )
    return img.resize((size, size), Image.BICUBIC)


def blob(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float, fill,
         shape=BLOB, rot: float = 0.0, squash: float = 0.74) -> None:
    """A closed irregular curve.

    The control radii are interpolated with a cosine rather than joined
    straight, so the outline curves between them instead of showing the
    sixteen facets of the underlying polygon.
    """
    n = len(shape)
    pts = []
    steps = n * 12
    for s in range(steps):
        t = s / steps * n
        i = int(t)
        f = t - i
        # Cosine interpolation: smooth at the control points, unlike linear.
        w = (1 - math.cos(f * math.pi)) / 2
        k = shape[i % n] * (1 - w) + shape[(i + 1) % n] * w
        a = (s / steps) * math.tau + rot
        pts.append((cx + math.cos(a) * r * k, cy + math.sin(a) * r * k * squash))
    draw.polygon(pts, fill=fill)


def mark(draw: ImageDraw.ImageDraw, cx: float, cy: float, span: float) -> None:
    """The viewfinder and the damage inside it, centred on (cx, cy)."""
    arm = span * 0.30          # bracket arm length
    weight = max(2, round(span * 0.052))
    inset = span / 2

    # Corner brackets. Drawn as two lines each rather than an arc so the
    # corners stay crisp when Android masks the icon to a circle.
    for sx in (-1, 1):
        for sy in (-1, 1):
            x = cx + sx * inset
            y = cy + sy * inset
            draw.line([(x, y), (x - sx * arm, y)], fill=WHITE, width=weight)
            draw.line([(x, y), (x, y - sy * arm)], fill=WHITE, width=weight)
            # Square off the join; a butt cap leaves a notch at this weight.
            h = weight / 2
            draw.ellipse([x - h, y - h, x + h, y + h], fill=WHITE)

    # The damage: a deeper core offset down and right of the opening, which is
    # how a pothole photographs under daylight — the far wall is lit, the near
    # wall and the floor are not. The core is rotated against the rim so the
    # two outlines do not echo each other.
    r = span * 0.30
    blob(draw, cx, cy, r, AMBER)
    blob(draw, cx + r * 0.12, cy + r * 0.14, r * 0.58, AMBER_DEEP,
         shape=CORE, rot=0.9)


def icon(size: int, *, transparent: bool, safe: float) -> Image.Image:
    """`safe` is the fraction of the canvas the mark may occupy."""
    big = size * SS
    if transparent:
        img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    else:
        img = gradient(big).convert("RGBA")
    draw = ImageDraw.Draw(img)
    mark(draw, big / 2, big / 2, big * safe)
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # Full bleed. iOS and the Play Store round the corners themselves, so
    # rounding them here would show as a dark fringe inside the mask.
    icon(1024, transparent=False, safe=0.58).save(OUT / "icon.png")

    # Android masks an adaptive icon to shapes that can cut 33% off, so the
    # mark is smaller and the background is a separate flat colour in app.json.
    icon(1024, transparent=True, safe=0.42).save(OUT / "adaptive-icon.png")

    # Splash: the mark alone on the declared background colour.
    icon(512, transparent=True, safe=0.62).save(OUT / "splash-icon.png")

    # Favicon for the web build.
    icon(64, transparent=False, safe=0.60).save(OUT / "favicon.png")

    for f in sorted(OUT.iterdir()):
        print(f"{f.name:22s} {f.stat().st_size / 1024:6.1f} KB")


if __name__ == "__main__":
    main()
