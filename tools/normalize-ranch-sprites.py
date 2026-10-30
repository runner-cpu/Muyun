"""Normalize generated 4x4 source sheets without stretching individual frames.

New art is generated through the user's global image command. This script only
removes its chroma background, shares one scale across each subject's whole
animation, aligns the feet, and exports the runtime atlas and review previews.
"""
from pathlib import Path
import json

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "output/imagegen"
DEST = ROOT / "client/public/assets/sprites"
REVIEW = ROOT / "output/review"
SUBJECTS = {"herder": (48, 64), "yak": (64, 64), "sheep": (64, 64)}


def remove_chroma(image):
    image = image.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            # The source contains no purple clothing/fur; clear the keyed field
            # including its antialiased fringe instead of leaving pink outlines.
            if r > 100 and b > 90 and min(r, b) > g * 1.5:
                pixels[x, y] = (0, 0, 0, 0)
            elif a:
                pixels[x, y] = (r, g, b, 255)
    return image


def grid_cuts(image, horizontal):
    """Use blank gutters: generated source spacing may drift a few pixels."""
    alpha = image.getchannel("A")
    length = image.width if horizontal else image.height
    empty = []
    for p in range(length):
        stripe = (p, 0, p + 1, image.height) if horizontal else (0, p, image.width, p + 1)
        if alpha.crop(stripe).getbbox() is None:
            empty.append(p)
    gaps = []
    start = previous = empty[0]
    for p in empty[1:] + [length + 1]:
        if p != previous + 1:
            if previous - start >= 3:
                gaps.append((start + previous) // 2)
            start = p
        previous = p
    return [0] + [min(gaps, key=lambda p: abs(p - length * i / 4))
                  for i in range(1, 4)] + [length]


def normalize(name, size):
    source = remove_chroma(Image.open(SOURCE / f"{name}-sheet-source.png"))
    columns, rows = grid_cuts(source, True), grid_cuts(source, False)
    frames = []
    bounds = []
    for row in range(4):
        for col in range(4):
            slot = source.crop((columns[col], rows[row], columns[col + 1], rows[row + 1]))
            box = slot.getbbox()
            if not box:
                raise ValueError(f"Missing frame: {name} row {row} col {col}")
            if box[0] == 0 or box[1] == 0 or box[2] == slot.width or box[3] == slot.height:
                raise ValueError(f"Subject touches slot boundary: {name} {row}/{col}")
            frames.append(slot.crop(box))
            bounds.append(box)
    width, height = size
    scale = min((width - 6) / max(f.width for f in frames),
                (height - 6) / max(f.height for f in frames))
    atlas = Image.new("RGBA", (width * 4, height * 4))
    normalized = []
    for index, frame in enumerate(frames):
        # One scale for the whole sheet is essential: side views must never be
        # inflated independently to fill the same rectangle as front views.
        frame = frame.resize((round(frame.width * scale), round(frame.height * scale)),
                             Image.Resampling.NEAREST)
        fixed = Image.new("RGBA", size)
        fixed.alpha_composite(frame, ((width - frame.width) // 2, height - 3 - frame.height))
        normalized.append(fixed)
        atlas.alpha_composite(fixed, ((index % 4) * width, (index // 4) * height))
    atlas.save(DEST / f"{name}-detailed.png", optimize=True)

    preview = Image.new("RGB", (width * 12, height * 12), "#315341")
    draw = ImageDraw.Draw(preview)
    for i, frame in enumerate(normalized):
        x, y = (i % 4) * width * 3, (i // 4) * height * 3
        preview.paste(frame.resize((width * 3, height * 3), Image.Resampling.NEAREST),
                      (x, y), frame.resize((width * 3, height * 3), Image.Resampling.NEAREST))
        draw.rectangle((x, y, x + width * 3 - 1, y + height * 3 - 1), outline="#49674e")
    preview.save(REVIEW / f"{name}-sprite-preview.png")

    # A short GIF makes scale/anchor drift visible without needing the engine.
    sequence = []
    for frame in normalized:
        canvas = Image.new("RGB", (width * 4, height * 4), "#315341")
        zoomed = frame.resize(canvas.size, Image.Resampling.NEAREST)
        canvas.paste(zoomed, (0, 0), zoomed)
        sequence.append(canvas)
    sequence[0].save(REVIEW / f"{name}-sprite-preview.gif", save_all=True,
                     append_images=sequence[1:], duration=240, loop=0)
    return {"name": name, "frame": size, "rows": ["down", "left", "right", "up"],
            "framesPerDirection": 4, "sharedScale": round(scale, 5),
            "sourceColumns": columns, "sourceRows": rows,
            "sourceBounds": bounds, "baseline": height - 3}


DEST.mkdir(parents=True, exist_ok=True)
REVIEW.mkdir(parents=True, exist_ok=True)
metadata = [normalize(name, size) for name, size in SUBJECTS.items()]
(SOURCE / "ranch-sprites-normalization.json").write_text(
    json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(metadata, ensure_ascii=False))
