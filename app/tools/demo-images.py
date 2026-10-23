"""Make the app's demo creatives from the LYSNE Engine Batch 2 tiles (9 Oct 2026).
Each chosen tile becomes three formats: feed 4:5 (560x700), square 1:1 (560x560), story 9:16 (450x800), JPEG q72.
LYSNE is a demo brand for internal use (check against LYS Beauty before anything goes public).
Usage: python3 app/tools/demo-images.py <generated-tiles-dir> <out-dir>"""
import sys
from pathlib import Path
from PIL import Image, ImageOps

TILES = ["01-03", "01-04", "01-07", "01-12", "02-01", "02-04", "02-05", "02-09", "03-02", "03-05",
         "03-08", "03-12", "04-02", "04-05", "04-06", "04-08", "05-01", "05-03", "05-06", "05-08",
         "06-04", "06-05", "06-10", "07-02", "07-10", "07-11", "08-02", "08-06", "09-02", "09-04",
         "09-07", "09-13", "09-15", "10-06", "10-08", "07-05"]
SIZES = {"feed": (560, 700), "square": (560, 560), "story": (450, 800)}

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
for t in TILES:
    im = Image.open(src / f"tile-{t}.png").convert("RGB")
    for name, size in SIZES.items():
        ImageOps.fit(im, size, Image.LANCZOS, centering=(0.5, 0.45)).save(out / f"{t}-{name}.jpg", quality=72, optimize=True, progressive=True)
print(len(TILES) * 3, "images")
