from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from build_laporan_v3 import add_numbering_definition


DOCX = Path(r"D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\V.3-Laporan-KP-NagariSDLC-Lengkap.docx")


def has_numbering(paragraph) -> bool:
    ppr = paragraph._p.pPr
    return ppr is not None and ppr.numPr is not None and ppr.numPr.numId is not None


def set_num_id(paragraph, num_id: int) -> None:
    ppr = paragraph._p.get_or_add_pPr()
    num_pr = ppr.numPr
    if num_pr is None:
        num_pr = OxmlElement("w:numPr")
        ppr.append(num_pr)
    ilvl = num_pr.ilvl
    if ilvl is None:
        ilvl = OxmlElement("w:ilvl")
        ilvl.set(qn("w:val"), "0")
        num_pr.insert(0, ilvl)
    num = num_pr.numId
    if num is None:
        num = OxmlElement("w:numId")
        num_pr.append(num)
    num.set(qn("w:val"), str(num_id))


def main() -> None:
    doc = Document(DOCX)
    groups = []
    current = []
    for paragraph in doc.paragraphs:
        if has_numbering(paragraph):
            current.append(paragraph)
        elif current:
            groups.append(current)
            current = []
    if current:
        groups.append(current)

    for group in groups:
        num_id = add_numbering_definition(doc, "decimal")
        for paragraph in group:
            set_num_id(paragraph, num_id)

    doc.save(DOCX)
    print(f"restarted_groups={len(groups)}")


if __name__ == "__main__":
    main()
