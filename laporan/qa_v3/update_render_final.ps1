param(
    [string]$DocxPath = "D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\V.4.1-FINAL-Laporan-KP-NagariSDLC-Siap-Cetak.docx",
    [string]$PdfPath = "D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\qa_v3\final_render\V.4.1-FINAL-Laporan-KP-NagariSDLC-Siap-Cetak.pdf"
)

$ErrorActionPreference = "Stop"
$word = $null
$document = $null
try {
    New-Item -ItemType Directory -Path (Split-Path -Parent $PdfPath) -Force | Out-Null
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.ScreenUpdating = $false
    $word.Options.UpdateFieldsAtPrint = $true
    $document = $word.Documents.Open($DocxPath, $false, $false)

    Write-Output "OPENED"
    [void]$document.Fields.Update()
    Write-Output "FIELDS_UPDATED"
    foreach ($toc in @($document.TablesOfContents)) { $toc.Update() }
    Write-Output "TOC_UPDATED"
    foreach ($tof in @($document.TablesOfFigures)) { $tof.Update() }
    Write-Output "TOF_UPDATED"
    $document.Repaginate()
    Write-Output "REPAGINATED"

    foreach ($section in @($document.Sections)) {
        foreach ($footerIndex in 1, 2, 3) {
            try { [void]$section.Footers.Item($footerIndex).Range.Fields.Update() } catch {}
        }
        foreach ($headerIndex in 1, 2, 3) {
            try { [void]$section.Headers.Item($headerIndex).Range.Fields.Update() } catch {}
        }
    }

    $document.Save()
    Write-Output "SAVED"
    $document.ExportAsFixedFormat($PdfPath, 17)
    Write-Output "EXPORTED"
    $pages = $document.ComputeStatistics(2)
    $document.Close(0)
    $document = $null
    $word.Quit()
    $word = $null
    Write-Output "DOCX=$DocxPath"
    Write-Output "PDF=$PdfPath"
    Write-Output "PAGES=$pages"
}
finally {
    if ($null -ne $document) { try { $document.Close(0) } catch {} }
    if ($null -ne $word) { try { $word.Quit() } catch {} }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
