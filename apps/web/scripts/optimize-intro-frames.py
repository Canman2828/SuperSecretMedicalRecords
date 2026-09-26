"""
Makes small WebP copies of the Prescriptive intro frames (keeps transparency).

    python apps/web/scripts/optimize-intro-frames.py

Reads  apps/web/public/prescriptive-intro/0001.png ... 0183.png
Writes 0001.webp ... next to them. The page loads the .webp files when they exist
(about 10 MB in total instead of ~250 MB of PNGs) and falls back to the .png files.
Your PNGs are never changed. Re-run after re-exporting the animation.
Needs Pillow:  pip install pillow
"""
from pathlib import Path

from PIL import Image

FOLDER = Path(__file__).resolve().parents[1] / "public" / "prescriptive-intro"
QUALITY = 85

pngs = sorted(FOLDER.glob("[0-9][0-9][0-9][0-9].png"))
if not pngs:
    raise SystemExit(f"No frames like 0001.png found in {FOLDER}")

before = after = 0
for png in pngs:
    webp = png.with_suffix(".webp")
    if not webp.exists() or webp.stat().st_mtime < png.stat().st_mtime:
        Image.open(png).save(webp, "WEBP", quality=QUALITY, method=4)
    before += png.stat().st_size
    after += webp.stat().st_size

print(f"{len(pngs)} frames: {before / 1e6:.0f} MB of PNG -> {after / 1e6:.1f} MB of WebP in {FOLDER}")
