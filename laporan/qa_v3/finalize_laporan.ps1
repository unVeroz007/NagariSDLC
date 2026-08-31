param(
    [string]$SourcePath = "D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\V.3-Laporan-KP-NagariSDLC-Lengkap.docx",
    [string]$OutputPath = "D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\V.4-Laporan-KP-NagariSDLC-Siap-Cetak.docx",
    [string]$PdfPath = "D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\qa_v3\final_render\V.4-Laporan-KP-NagariSDLC-Siap-Cetak.pdf"
)

$ErrorActionPreference = "Stop"
$wdFindContinue = 1
$wdReplaceAll = 2
$wdCollapseEnd = 0
$wdFieldEmpty = -1
$wdStyleHeading2 = -3
$wdStyleHeading4 = -5
$wdStyleCaption = -35
$wdAlignParagraphLeft = 0
$wdAlignParagraphCenter = 1
$wdAlignParagraphJustify = 3
$wdAlignTabRight = 2
$wdTabLeaderDots = 1
$wdExportFormatPDF = 17
$wdDoNotSaveChanges = 0
$paragraphMark = [char]13

function Find-Range {
    param($Document, [string]$Text)
    $range = $Document.Content.Duplicate
    $find = $range.Find
    $find.ClearFormatting()
    $find.Text = $Text
    $find.Forward = $true
    $find.Wrap = 0
    $find.Format = $false
    $find.MatchCase = $false
    $find.MatchWholeWord = $false
    $find.MatchWildcards = $false
    if ($find.Execute()) { return $range }
    return $null
}

function Replace-AllText {
    param($Document, [string]$OldText, [string]$NewText)
    $range = $Document.Content.Duplicate
    $find = $range.Find
    $find.ClearFormatting()
    $find.Replacement.ClearFormatting()
    [void]$find.Execute($OldText, $false, $false, $false, $false, $false, $true, $wdFindContinue, $false, $NewText, $wdReplaceAll)
}

function Set-BodyParagraph {
    param($Paragraph)
    $Paragraph.Range.Font.Name = "Times New Roman"
    $Paragraph.Range.Font.Size = 12
    $Paragraph.Range.ParagraphFormat.Alignment = $wdAlignParagraphJustify
    $Paragraph.Range.ParagraphFormat.SpaceAfter = 10
}

function Add-ListFieldAfterHeading {
    param($Document, [string]$HeadingText, [string]$FieldCode)
    $heading = Find-Range $Document $HeadingText
    if ($null -eq $heading) { throw "Heading tidak ditemukan: $HeadingText" }
    $position = $heading.Paragraphs.Item(1).Range.End
    $insert = $Document.Range($position, $position)
    $field = $Document.Fields.Add($insert, $wdFieldEmpty, $FieldCode, $false)
    $field.Result.ParagraphFormat.Alignment = $wdAlignParagraphLeft
    $field.Result.Font.Name = "Times New Roman"
    $field.Result.Font.Size = 11
    return $field
}

if (-not (Test-Path -LiteralPath $SourcePath)) { throw "Dokumen sumber tidak ditemukan: $SourcePath" }
New-Item -ItemType Directory -Path (Split-Path -Parent $OutputPath) -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path -Parent $PdfPath) -Force | Out-Null
Copy-Item -LiteralPath $SourcePath -Destination $OutputPath -Force

$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.ScreenUpdating = $false
    $document = $word.Documents.Open($OutputPath, $false, $false)
    $document.TrackRevisions = $false
    if ($document.Revisions.Count -gt 0) { $document.Revisions.AcceptAll() }
    while ($document.Comments.Count -gt 0) { $document.Comments.Item(1).Delete() }

    $replacements = @(
        @("PT Bank Bank Nagari", "PT Bank Nagari"),
        @("Grub Pengembangan", "Grup Pengembangan"),
        @("di Grub", "di Grup"),
        @("focus", "fokus"),
        @("kepatihan", "kepatuhan"),
        @("Fery Arjendi Putra, S.Kom., CITPM", "Ferry Arjendi Putra, S.Kom., CITPM"),
        @("Padang, Agustus 2026", "Padang, 31 Agustus 2026"),
        @("Analist", "Analis"),
        @("Gambar lampiran", "Gambar Lampiran"),
        @("Monitoring Proyek Berjalan Oleh", "Monitoring Proyek Berjalan oleh"),
        @("Tabel 4.7 Tabel domain utama", "Tabel 4.7 Domain utama")
    )
    foreach ($replacement in $replacements) { Replace-AllText $document $replacement[0] $replacement[1] }

    Replace-AllText $document "Informasi profil perusahaan yang belum didukung dokumen resmi sengaja tidak dikarang dan ditandai sebagai placeholder untuk dilengkapi penulis." "Profil instansi pada laporan ini disusun berdasarkan informasi perusahaan dan dokumen pelaksanaan Kerja Praktek yang tersedia."
    Replace-AllText $document "6. Tangkapan layar, logo, struktur organisasi resmi, dan dokumen pengesahan ditandai sebagai placeholder hingga bahan resmi tersedia." "6. Tangkapan layar dan diagram dibatasi pada bagian yang relevan dengan pembahasan serta tidak menampilkan data produksi atau informasi sensitif."
    Replace-AllText $document "8. Diagram tidak disisipkan sebagai gambar; dokumen menampilkan placeholder dan berkas pendamping menyediakan kode Mermaid." "8. Diagram proses, UML, ERD, sequence, dan navigasi merepresentasikan rancangan serta implementasi pada saat laporan disusun."

    Replace-AllText $document "1. Lengkapi seluruh placeholder identitas, profil resmi, struktur organisasi, logo, foto, tanda tangan, dan bukti kegiatan sebelum pengesahan." "1. Lakukan pengujian regresi backend, pemeriksaan lint, build frontend, dan pengujian end-to-end setelah setiap perubahan utama agar kestabilan sistem tetap terjaga."
    Replace-AllText $document "2. Render kode Mermaid pada berkas pendamping, periksa keterbacaan, lalu masukkan setiap gambar pada placeholder dengan caption yang tetap." "2. Tetapkan konfigurasi dan prosedur operasional produksi untuk database, queue, object storage, CORS, Reverb, backup, monitoring, logging, serta retensi data."
    Replace-AllText $document "3. Lakukan pengujian ulang backend, ESLint, build, dan pengujian end-to-end setelah perubahan source code terakhir sebelum laporan dinyatakan final." "3. Tambahkan pemantauan kesehatan layanan, metrik performa, pencatatan kesalahan terpusat, dan mekanisme pemulihan agar gangguan operasional dapat dideteksi lebih cepat."
    Replace-AllText $document "4. Tetapkan konfigurasi dan SOP produksi untuk database, queue, storage, CORS, Reverb, backup, monitoring, logging, serta retensi data." "4. Pertahankan seluruh transisi proyek melalui ProjectWorkflowService dan seluruh penulisan return round melalui ProjectReturnRoundService agar aturan bisnis tetap terpusat."
    Replace-AllText $document "5. Pertahankan seluruh transisi proyek melalui ProjectWorkflowService dan seluruh penulisan return round melalui ProjectReturnRoundService." "5. Pertahankan approval, histori status, laporan pengujian, activity log, dan bukti dokumen sebagai audit trail serta hindari hard delete tanpa kebijakan retensi resmi."
    Replace-AllText $document "6. Hindari hard delete pada approval, histori, laporan pengujian, dan bukti dokumen kecuali telah ada keputusan retensi resmi." "6. Lakukan evaluasi usability dan pengukuran karakteristik kualitas ISO/IEC 25010 secara berkala menggunakan data penggunaan nyata setelah sistem diterapkan."

    $babTwo = Find-Range $document "BAB II"
    if ($null -eq $babTwo) { throw "BAB II tidak ditemukan." }
    $insertStart = $babTwo.Start
    $newSections = "1.6 Metode Pelaksanaan" + $paragraphMark +
        "Pelaksanaan Kerja Praktek dilakukan melalui tahapan observasi proses kerja dan identifikasi kebutuhan, penelaahan dokumentasi proyek serta literatur, analisis dan perancangan sistem, implementasi secara iteratif, pengujian, dan penyusunan dokumentasi. Setiap hasil analisis dikonfirmasi terhadap alur kerja NagariSDLC dan implementasi aktif agar rancangan antarmuka, layanan API, model data, kontrol akses, serta transisi status tetap konsisten." + $paragraphMark +
        "1.7 Sistematika Penulisan" + $paragraphMark +
        "Laporan ini disusun dalam lima bab. Bab I menjelaskan latar belakang, rumusan masalah, tujuan, manfaat, batasan, metode pelaksanaan, dan sistematika penulisan. Bab II memuat profil instansi, unit kerja, posisi mahasiswa, serta kegiatan Kerja Praktek. Bab III menguraikan landasan teori dan penelitian yang mendukung pengembangan NagariSDLC. Bab IV menyajikan hasil analisis, perancangan, implementasi, pengujian, dan pembahasan sistem. Bab V berisi kesimpulan dan saran, kemudian dilanjutkan dengan daftar pustaka serta lampiran teknis." + $paragraphMark
    $document.Range($insertStart, $insertStart).InsertBefore($newSections)
    $babTwoAfterInsert = Find-Range $document "BAB II"
    $addedRange = $document.Range($insertStart, $babTwoAfterInsert.Start)
    foreach ($paragraph in @($addedRange.Paragraphs)) {
        $paragraphText = ($paragraph.Range.Text -replace "[\r\a]+$", "").Trim()
        if ($paragraphText -match "^1\.(6|7)\s") {
            $paragraph.Range.Style = $wdStyleHeading2
        } elseif ($paragraphText.Length -gt 0) {
            Set-BodyParagraph $paragraph
        }
    }

    foreach ($paragraph in @($document.Paragraphs)) {
        $paragraphText = ($paragraph.Range.Text -replace "[\r\a]+$", "").Trim()
        if ($paragraphText -match "^4\.1\.15\.([1-9]|1[0-6])\s") { $paragraph.Range.Style = $wdStyleHeading4 }
    }
    $headingFourStyle = $document.Styles.Item($wdStyleHeading4)
    $headingFourStyle.Font.Name = "Times New Roman"
    $headingFourStyle.Font.Bold = $true
    $headingFourStyle.Font.ColorIndex = 1
    $headingFourStyle.ParagraphFormat.SpaceBefore = 5
    $headingFourStyle.ParagraphFormat.SpaceAfter = 2
    $headingFourStyle.ParagraphFormat.KeepWithNext = $true

    $captionEntries = New-Object System.Collections.Generic.List[object]
    $lastSequence = @{}
    foreach ($paragraph in @($document.Paragraphs)) {
        $captionText = ($paragraph.Range.Text -replace "[\r\a]+$", "").Trim()
        if ($captionText -match "^(Gambar|Tabel)\s+([234AB])\.([0-9]+)\s+(.+)$") {
            $label = $Matches[1]
            $chapter = $Matches[2]
            $title = $Matches[4].Trim()
            $sequenceKey = "$label|$chapter"
            $reset = -not $lastSequence.ContainsKey($sequenceKey)
            $lastSequence[$sequenceKey] = $true
            $captionEntries.Add([pscustomobject]@{ Start = $paragraph.Range.Start; Label = $label; Chapter = $chapter; Title = $title; Reset = $reset })
        }
    }

    for ($index = $captionEntries.Count - 1; $index -ge 0; $index--) {
        $entry = $captionEntries[$index]
        $paragraph = $document.Range($entry.Start, $entry.Start).Paragraphs.Item(1)
        $contentRange = $paragraph.Range.Duplicate
        if ($contentRange.End -gt $contentRange.Start) { $contentRange.End = $contentRange.End - 1 }
        $contentRange.Text = "$($entry.Label) $($entry.Chapter)."
        $contentRange.Collapse($wdCollapseEnd)
        if ($entry.Reset) { $fieldCode = "SEQ $($entry.Label) \r 1 \* ARABIC" } else { $fieldCode = "SEQ $($entry.Label) \* ARABIC" }
        $sequenceField = $document.Fields.Add($contentRange, $wdFieldEmpty, $fieldCode, $false)
        $document.Range($sequenceField.Result.End, $sequenceField.Result.End).InsertAfter(" $($entry.Title)")
        $formattedParagraph = $document.Range($entry.Start, $entry.Start).Paragraphs.Item(1)
        $formattedParagraph.Range.Style = $wdStyleCaption
        $formattedParagraph.Range.Font.Name = "Times New Roman"
        $formattedParagraph.Range.Font.Size = 9
        $formattedParagraph.Range.Font.Bold = $true
        $formattedParagraph.Range.ParagraphFormat.Alignment = $wdAlignParagraphCenter
        $formattedParagraph.Range.ParagraphFormat.KeepWithNext = $true
        $formattedParagraph.Range.ParagraphFormat.SpaceAfter = 4
    }

    foreach ($table in @($document.Tables)) {
        if ($table.Rows.Count -gt 0) {
            try { $table.Rows.Item(1).HeadingFormat = $true } catch {}
        }
    }

    foreach ($styleName in @("TOC 1", "TOC 2", "TOC 3", "Table of Figures")) {
        try {
            $style = $document.Styles.Item($styleName)
            $style.Font.Name = "Times New Roman"
            $style.Font.Size = 11
            $style.Font.ColorIndex = 1
            $style.ParagraphFormat.SpaceBefore = 0
            $style.ParagraphFormat.SpaceAfter = 2
        } catch {}
    }

    [void](Add-ListFieldAfterHeading $document "DAFTAR ISI" 'TOC \o "1-3" \h \z \u')
    [void](Add-ListFieldAfterHeading $document "DAFTAR TABEL" 'TOC \h \z \c "Tabel"')
    [void](Add-ListFieldAfterHeading $document "DAFTAR GAMBAR" 'TOC \h \z \c "Gambar"')

    $appendices = @(
        @{ Key = "A"; Heading = "Lampiran A Endpoint API"; Entry = "Lampiran A - Endpoint API" },
        @{ Key = "B"; Heading = "Lampiran B Kamus Data Ringkas"; Entry = "Lampiran B - Kamus Data Ringkas" },
        @{ Key = "C"; Heading = "Lampiran C Tampilan Lengkap"; Entry = "Lampiran C - Tampilan Lengkap" }
    )
    foreach ($appendix in $appendices) {
        $appendixRange = Find-Range $document $appendix.Heading
        if ($null -eq $appendixRange) { throw "Judul lampiran tidak ditemukan: $($appendix.Heading)" }
        $bookmarkName = "Lampiran$($appendix.Key)"
        if ($document.Bookmarks.Exists($bookmarkName)) { $document.Bookmarks.Item($bookmarkName).Delete() }
        [void]$document.Bookmarks.Add($bookmarkName, $appendixRange)
    }

    $listHeading = Find-Range $document "DAFTAR LAMPIRAN"
    if ($null -eq $listHeading) { throw "DAFTAR LAMPIRAN tidak ditemukan." }
    $listPosition = $listHeading.Paragraphs.Item(1).Range.End
    $listText = ""
    foreach ($appendix in $appendices) { $listText += "$($appendix.Entry)" + [char]9 + "[[PAGE_$($appendix.Key)]]" + $paragraphMark }
    $document.Range($listPosition, $listPosition).InsertAfter($listText)
    foreach ($appendix in $appendices) {
        $placeholder = "[[PAGE_$($appendix.Key)]]"
        $pageRange = Find-Range $document $placeholder
        if ($null -eq $pageRange) { throw "Placeholder halaman lampiran tidak ditemukan: $placeholder" }
        $pageRange.Text = ""
        [void]$document.Fields.Add($pageRange, $wdFieldEmpty, "PAGEREF Lampiran$($appendix.Key) \h", $false)
    }
    $lastEntry = Find-Range $document "Lampiran C - Tampilan Lengkap"
    $listBlock = $document.Range($listPosition, $lastEntry.Paragraphs.Item(1).Range.End)
    foreach ($paragraph in @($listBlock.Paragraphs)) {
        $paragraph.Range.Font.Name = "Times New Roman"
        $paragraph.Range.Font.Size = 11
        $paragraph.Range.ParagraphFormat.SpaceAfter = 3
        $paragraph.Range.ParagraphFormat.TabStops.ClearAll()
        [void]$paragraph.Range.ParagraphFormat.TabStops.Add(396, $wdAlignTabRight, $wdTabLeaderDots)
    }

    $word.Options.UpdateFieldsAtPrint = $true
    $document.Repaginate()
    for ($pass = 1; $pass -le 3; $pass++) {
        try { [void]$document.Fields.Update() } catch {}
        foreach ($tableOfContents in @($document.TablesOfContents)) { $tableOfContents.Update() }
        foreach ($tableOfFigures in @($document.TablesOfFigures)) { $tableOfFigures.Update() }
        $document.Repaginate()
    }

    try { $document.RemoveDocumentInformation(99) } catch {}
    $document.Save()
    $document.ExportAsFixedFormat($PdfPath, $wdExportFormatPDF)
    $document.Close($wdDoNotSaveChanges)
    $document = $null
    $word.Quit()
    $word = $null
    Write-Output "DOCX=$OutputPath"
    Write-Output "PDF=$PdfPath"
    Write-Output "CAPTIONS_CONVERTED=$($captionEntries.Count)"
}
finally {
    if ($null -ne $document) { try { $document.Close($wdDoNotSaveChanges) } catch {} }
    if ($null -ne $word) { try { $word.Quit() } catch {} }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
