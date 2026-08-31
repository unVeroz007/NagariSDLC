from pathlib import Path
import sys

from PIL import Image, ImageDraw


SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "pages_final2"
OUTPUT = SOURCE / "contacts"
OUTPUT.mkdir(exist_ok=True)

pages = sorted(SOURCE.glob("page-*.png"))
thumb_w = 310
gap = 18

for offset in range(0, len(pages), 4):
    batch = pages[offset : offset + 4]
    thumbs = []
    for path in batch:
        image = Image.open(path).convert("RGB")
        height = round(image.height * thumb_w / image.width)
        image.thumbnail((thumb_w, height))
        thumbs.append((path, image.copy()))

    cell_h = max(image.height for _, image in thumbs) + 34
    canvas = Image.new("RGB", (thumb_w * 2 + gap * 3, cell_h * 2 + gap * 3), "#d9d9d9")
    draw = ImageDraw.Draw(canvas)
    for index, (path, image) in enumerate(thumbs):
        col = index % 2
        row = index // 2
        x = gap + col * (thumb_w + gap)
        y = gap + row * (cell_h + gap)
        canvas.paste(image, (x, y + 24))
        draw.text((x, y + 4), path.stem, fill="black")

    start = offset + 1
    end = offset + len(batch)
    canvas.save(OUTPUT / f"contact-{start:02d}-{end:02d}.png")
