from __future__ import annotations

import json
import re
from pathlib import Path

import pdfplumber
from docx import Document
from docx.shared import Pt

from finalize_laporan_docx import all_paragraphs, clean_text, set_plain_text


DOCX_IN = Path(r"D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\V.4.8-FINAL-Laporan-KP-NagariSDLC-Siap-Cetak.docx")
DOCX_OUT = Path(r"D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\FINAL-Laporan-KP-NagariSDLC-Siap-Cetak.docx")
PDF_IN = Path(r"D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\qa_v3\final_render\pass4.pdf")
MANIFEST = Path(r"D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\qa_v3\final_static_manifest.json")


def normalize(text: str) -> str:
    return " ".join(text.replace("\xa0", " ").split())


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text).casefold()


def roman(number: int) -> str:
    values = [
        (1000, "m"),
        (900, "cm"),
        (500, "d"),
        (400, "cd"),
        (100, "c"),
        (90, "xc"),
        (50, "l"),
        (40, "xl"),
        (10, "x"),
        (9, "ix"),
        (5, "v"),
        (4, "iv"),
        (1, "i"),
    ]
    result = []
    remaining = number
    for value, numeral in values:
        while remaining >= value:
            result.append(numeral)
            remaining -= value
    return "".join(result)


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    with pdfplumber.open(PDF_IN) as pdf:
        raw_texts = [page.extract_text() or "" for page in pdf.pages]
        page_texts = [normalize(text) for text in raw_texts]
        page_search = [compact(text) for text in raw_texts]
        page_lines = [[line.strip() for line in text.splitlines() if line.strip()] for text in raw_texts]

    content_start = None
    for index, lines in enumerate(page_lines):
        top = compact(" ".join(lines[:3]))
        if top.startswith(compact("BAB I PENDAHULUAN")):
            content_start = index
            break
    if content_start is None:
        raise RuntimeError("Halaman awal BAB I tidak ditemukan.")

    front_titles = {
        "ABSTRAK",
        "KATA PENGANTAR",
        "DAFTAR ISI",
        "DAFTAR TABEL",
        "DAFTAR GAMBAR",
        "DAFTAR LAMPIRAN",
    }

    page_map: dict[str, str] = {}
    missing: list[str] = []
    for item in manifest:
        target = normalize(str(item["target"]))
        target_search = compact(target)
        found = None
        if target in front_titles:
            for index in range(content_start):
                if target_search in page_search[index]:
                    found = index
                    break
        else:
            for index in range(content_start, len(page_texts)):
                if target_search in page_search[index]:
                    found = index
                    break
        if found is None and target == "Gambar 4.12 Class relationship inti":
            previous_target = compact("Gambar 4.11 ERD NagariSDLC")
            for index in range(content_start, len(page_texts)):
                if previous_target in page_search[index]:
                    found = min(index + 1, len(page_texts) - 1)
                    break
        if found is None:
            missing.append(target)
            continue
        if found < content_start:
            page_map[str(item["title"])] = roman(found)
        else:
            page_map[str(item["title"])] = str(found - content_start + 1)

    if missing:
        raise RuntimeError("Target halaman tidak ditemukan:\n- " + "\n- ".join(missing))

    document = Document(DOCX_IN)
    updated = 0
    for paragraph in all_paragraphs(document):
        style_name = paragraph.style.name if paragraph.style is not None else ""
        if style_name not in {"TOC 1", "TOC 2", "TOC 3", "Table of Figures"}:
            continue
        raw = paragraph.text
        if "\t" not in raw:
            continue
        title = raw.rsplit("\t", 1)[0]
        if title not in page_map:
            continue
        set_plain_text(paragraph, f"{title}\t{page_map[title]}")
        for run in paragraph.runs:
            run.font.name = "Times New Roman"
            run.font.size = Pt(11)
        updated += 1

    if updated != len(manifest):
        raise RuntimeError(f"Jumlah daftar yang diperbarui {updated}, seharusnya {len(manifest)}.")

    DOCX_OUT.parent.mkdir(parents=True, exist_ok=True)
    document.save(DOCX_OUT)
    print(f"OUTPUT={DOCX_OUT}")
    print(f"CONTENT_START_PHYSICAL={content_start + 1}")
    print(f"ENTRIES_UPDATED={updated}")
    print(f"TOTAL_PAGES={len(page_texts)}")


if __name__ == "__main__":
    main()
