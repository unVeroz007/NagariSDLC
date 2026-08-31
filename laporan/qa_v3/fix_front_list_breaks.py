from pathlib import Path

from docx import Document
from docx.oxml.ns import qn

from finalize_laporan_docx import all_paragraphs, clean_text


SOURCE = Path(r"D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\V.4.6-FINAL-Laporan-KP-NagariSDLC-Siap-Cetak.docx")
OUTPUT = Path(r"D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\V.4.7-FINAL-Laporan-KP-NagariSDLC-Siap-Cetak.docx")
LIST_HEADINGS = {"DAFTAR ISI", "DAFTAR TABEL", "DAFTAR GAMBAR", "DAFTAR LAMPIRAN"}


def main() -> None:
    document = Document(SOURCE)
    changed = 0
    for paragraph in all_paragraphs(document):
        title = clean_text(paragraph)
        if title not in LIST_HEADINGS:
            continue
        for page_break in list(paragraph._p.xpath(".//w:br[@w:type='page']")):
            page_break.getparent().remove(page_break)
            changed += 1
        paragraph.paragraph_format.page_break_before = title != "DAFTAR ISI"
        paragraph.paragraph_format.keep_with_next = True

    paragraphs = all_paragraphs(document)
    toc_index = next(i for i, paragraph in enumerate(paragraphs) if clean_text(paragraph) == "DAFTAR ISI")
    toc_heading = paragraphs[toc_index]
    previous_paragraph = paragraphs[toc_index - 1]
    if toc_heading._p.pPr is not None and toc_heading._p.pPr.sectPr is not None:
        section_properties = toc_heading._p.pPr.sectPr
        toc_heading._p.pPr.remove(section_properties)
        previous_paragraph._p.get_or_add_pPr().append(section_properties)
        changed += 1

    document.save(OUTPUT)
    print(f"OUTPUT={OUTPUT}")
    print(f"PAGE_BREAKS_REMOVED={changed}")


if __name__ == "__main__":
    main()
