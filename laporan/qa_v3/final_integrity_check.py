import re
from pathlib import Path
from zipfile import ZipFile

from docx import Document

from finalize_laporan_docx import all_paragraphs, clean_text


DOCX = Path(r"D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\FINAL-Laporan-KP-NagariSDLC-Siap-Cetak.docx")


def main() -> None:
    with ZipFile(DOCX) as package:
        bad_files = package.testzip()
        document_xml = package.read("word/document.xml")
    if bad_files is not None:
        raise RuntimeError(f"CRC ZIP gagal: {bad_files}")

    document = Document(DOCX)
    paragraphs = all_paragraphs(document)
    all_text = "\n".join(paragraph.text for paragraph in paragraphs)

    forbidden = [
        "placeholder",
        "Lampiran E",
        "Afjendi",
        "Grub Pengembangan",
        "Analist",
        "PT Bank Bank Nagari",
        "\t0",
    ]
    found_forbidden = [term for term in forbidden if term.casefold() in all_text.casefold()]
    if found_forbidden:
        raise RuntimeError(f"Teks terlarang tersisa: {found_forbidden}")

    if "Ferry Arjendi Putra, S.Kom., CITPM" not in all_text:
        raise RuntimeError("Nama pembimbing lapangan belum benar.")
    if "Padang, 31 Agustus 2026" not in all_text:
        raise RuntimeError("Tanggal final belum benar.")

    figure_numbers = []
    table_numbers = []
    for paragraph in paragraphs:
        text = clean_text(paragraph)
        figure_match = re.match(r"^Gambar ([24])\.(\d+)\s+", text)
        table_match = re.match(r"^Tabel ([234AB])\.(\d+)\s+", text)
        if figure_match and paragraph.style.name == "Caption":
            figure_numbers.append((figure_match.group(1), int(figure_match.group(2)), text))
        if table_match and paragraph.style.name == "Caption":
            table_numbers.append((table_match.group(1), int(table_match.group(2)), text))

    expected_figures = [("2", number) for number in range(1, 5)] + [
        ("4", number) for number in range(1, 33)
    ]
    actual_figures = [(chapter, number) for chapter, number, _ in figure_numbers]
    if actual_figures != expected_figures:
        raise RuntimeError(f"Urutan gambar salah: {actual_figures}")

    expected_tables = (
        [("2", number) for number in range(1, 3)]
        + [("3", number) for number in range(1, 5)]
        + [("4", number) for number in range(1, 16)]
        + [("A", 1), ("B", 1)]
    )
    actual_tables = [(chapter, number) for chapter, number, _ in table_numbers]
    if actual_tables != expected_tables:
        raise RuntimeError(f"Urutan tabel salah: {actual_tables}")

    list_entries = [
        paragraph
        for paragraph in paragraphs
        if paragraph.style.name in {"TOC 1", "TOC 2", "TOC 3", "Table of Figures"}
        and "\t" in paragraph.text
    ]
    if len(list_entries) != 165:
        raise RuntimeError(f"Jumlah entri daftar {len(list_entries)}, seharusnya 165.")

    if document.comments:
        raise RuntimeError("Komentar masih tersisa.")

    tracked_tags = sum(
        len(re.findall(pattern, document_xml))
        for pattern in (
            rb"<w:ins(?:\s|>)",
            rb"<w:del(?:\s|>)",
            rb"<w:moveFrom(?:\s|>)",
            rb"<w:moveTo(?:\s|>)",
        )
    )
    if tracked_tags:
        raise RuntimeError(f"Tracked changes tersisa: {tracked_tags}")

    print("ZIP_CRC=OK")
    print("PLACEHOLDERS=0")
    print("COMMENTS=0")
    print("TRACKED_CHANGES=0")
    print(f"LIST_ENTRIES={len(list_entries)}")
    print(f"FIGURES={len(figure_numbers)}")
    print(f"TABLES={len(table_numbers)}")
    print(f"IMAGES={len(document.inline_shapes)}")
    print(f"PARAGRAPHS={len(paragraphs)}")


if __name__ == "__main__":
    main()
