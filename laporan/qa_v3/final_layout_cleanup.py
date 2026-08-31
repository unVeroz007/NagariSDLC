import re
from pathlib import Path

from docx import Document
from docx.dml.color import RGBColor
from docx.oxml.ns import qn

from finalize_laporan_docx import all_paragraphs, clean_text


SOURCE = Path(r"D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\V.4.7-FINAL-Laporan-KP-NagariSDLC-Siap-Cetak.docx")
OUTPUT = Path(r"D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\V.4.8-FINAL-Laporan-KP-NagariSDLC-Siap-Cetak.docx")


def force_run_black(run_element) -> None:
    run_properties = run_element.find(qn("w:rPr"))
    if run_properties is None:
        from docx.oxml import OxmlElement

        run_properties = OxmlElement("w:rPr")
        run_element.insert(0, run_properties)
    color = run_properties.find(qn("w:color"))
    if color is None:
        from docx.oxml import OxmlElement

        color = OxmlElement("w:color")
        run_properties.append(color)
    color.set(qn("w:val"), "000000")
    color.attrib.pop(qn("w:themeColor"), None)


def main() -> None:
    document = Document(SOURCE)
    chapter_breaks = 0
    colored_paragraphs = 0
    removed_repeat_headers = 0

    for style_name in ("Caption", "Heading 4"):
        style = document.styles[style_name]
        style.font.color.rgb = RGBColor(0, 0, 0)

    for paragraph in all_paragraphs(document):
        title = clean_text(paragraph)
        style_name = paragraph.style.name if paragraph.style is not None else ""
        if style_name == "Heading 1" and (
            re.match(r"^BAB (II|III|IV|V)\b", title)
            or title in {"DAFTAR PUSTAKA", "LAMPIRAN"}
        ):
            paragraph.paragraph_format.page_break_before = True
            paragraph.paragraph_format.keep_with_next = True
            chapter_breaks += 1

        if style_name in {"Caption", "Heading 4"}:
            for run_element in paragraph._p.xpath(".//w:r"):
                force_run_black(run_element)
            colored_paragraphs += 1

    for table_element in document._element.body.iter(qn("w:tbl")):
        rows = table_element.findall(qn("w:tr"))
        has_drawing = bool(table_element.xpath(".//w:drawing"))
        if not has_drawing and len(rows) > 1:
            continue
        for header in list(table_element.xpath(".//w:trPr/w:tblHeader")):
            header.getparent().remove(header)
            removed_repeat_headers += 1

    document.save(OUTPUT)
    print(f"OUTPUT={OUTPUT}")
    print(f"CHAPTER_BREAKS={chapter_breaks}")
    print(f"COLORED_PARAGRAPHS={colored_paragraphs}")
    print(f"REPEAT_HEADERS_REMOVED={removed_repeat_headers}")


if __name__ == "__main__":
    main()
