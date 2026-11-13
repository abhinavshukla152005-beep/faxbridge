"""Generates the synthetic referral fax used by the in-app sample button."""

from pathlib import Path
import random

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "sample-referral.png"

FONT_DIR = Path("C:/Windows/Fonts")
REGULAR = FONT_DIR / "consola.ttf"
BOLD = FONT_DIR / "consolab.ttf"

body = ImageFont.truetype(str(REGULAR), 30)
head = ImageFont.truetype(str(BOLD), 34)
small = ImageFont.truetype(str(REGULAR), 22)

W, H = 1000, 1290
image = Image.new("L", (W, H), 252)
draw = ImageDraw.Draw(image)

left = 74
draw.text((left, 60), "CENTRAL CLINIC  -  CARDIOLOGY", font=head, fill=18)
draw.text((left, 104), "FAX COVER SHEET", font=small, fill=60)
draw.line((left, 140, W - left, 140), fill=40, width=3)

rows = [
    ("Fax date:", "12/11/2026", 24),
    ("From:", "Dr. R. Mehta, Cardiology", 20),
    ("To:", "Dr. S. Iyer, Nephrology", 20),
    ("", "", 14),
    ("Patient:", "Anita Sharma", 22),
    ("DOB:", "05/06/1980", 20),
    ("MRN:", "A-4471902", 20),
    ("Phone:", "09876543210", 20),
    ("", "", 18),
]

y = 196
for label, value, gap in rows:
    if label:
        draw.text((left, y), label, font=body, fill=25)
        draw.text((left + 240, y), value, font=body, fill=15)
    y += gap + 34

draw.line((left, y + 6, W - left, y + 6), fill=120, width=1)
y += 34
draw.text((left, y), "Reason for referral: uncontrolled hypertension", font=body, fill=15)
y += 52
draw.text((left, y), "Notes:", font=small, fill=60)
y += 30

notes = [
    "48 y/o female with persistently elevated BP despite two agents.",
    "Home readings average 158/96 over the last three weeks.",
    "No chest pain. eGFR 58. Please assess for secondary causes",
    "and review the current regimen. Kindly revert by fax.",
]
for line in notes:
    draw.text((left, y), line, font=small, fill=35)
    y += 33

draw.text((left, H - 120), "Pages: 1 of 1", font=small, fill=90)
draw.text((W - 330, H - 120), "Sent by: CENTRAL CLINIC FAX", font=small, fill=90)

random.seed(7)
pixels = image.load()
for _ in range(26000):
    x = random.randrange(W)
    py = random.randrange(H)
    value = max(0, min(255, pixels[x, py] + random.randint(-26, 26)))
    pixels[x, py] = value

image.save(OUT, optimize=True)
print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
