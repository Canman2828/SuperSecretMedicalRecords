"""
Makes the cropped, lightweight copies of the home-page hero renders.

    python apps/web/scripts/optimize-hero-renders.py

Reads  apps/web/public/hero-renders/Clipboard Render.png and Stetho Render.png (1920x1080, transparent)
Writes clipboard.webp and stethoscope.webp next to them, cropped to the visible object (transparency kept).
The home page loads the .webp files. Your PNGs are never changed. Re-run after re-rendering.
Needs Pillow:  pip install pillow
"""
from pathlib import Path

from PIL import Image

FOLDER = Path(__file__).resolve().parents[1] / "public" / "hero-renders"
RENDERS = {"Clipboard Render.png": "clipboard.webp", "Stetho Render.png": "stethoscope.webp"}
PAD = 12  # keep a little transparent margin so edges aren't clipped

for src, dst in RENDERS.items():
    im = Image.open(FOLDER / src).convert("RGBA")
    x0, y0, x1, y1 = im.getchannel("A").getbbox()
    box = (max(0, x0 - PAD), max(0, y0 - PAD), min(im.width, x1 + PAD), min(im.height, y1 + PAD))
    out = im.crop(box)
    out.save(FOLDER / dst, "WEBP", quality=90, method=4)
    print(f"{src} -> {dst}: {out.width}x{out.height}, {(FOLDER / dst).stat().st_size / 1e3:.0f} KB (aspect {out.width / out.height:.3f})")
