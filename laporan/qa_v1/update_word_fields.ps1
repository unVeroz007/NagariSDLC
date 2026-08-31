$ErrorActionPreference = 'Stop'
$docxPath = 'D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\V.2-Laporan-KP-NagariSDLC-Final.docx'
$pdfPath = 'D:\A1 COOLYEAH\MAGANG\NagariSDLC\laporan\qa_v1\V.2-Laporan-KP-NagariSDLC-Final.pdf'

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($docxPath, $false, $false)
    $doc.Repaginate()
    foreach ($toc in $doc.TablesOfContents) {
        $toc.Update() | Out-Null
    }
    $doc.Fields.Update() | Out-Null
    foreach ($section in $doc.Sections) {
        foreach ($header in $section.Headers) {
            $header.Range.Fields.Update() | Out-Null
        }
        foreach ($footer in $section.Footers) {
            $footer.Range.Fields.Update() | Out-Null
        }
    }
    $doc.Repaginate()
    $doc.Save()
    $doc.ExportAsFixedFormat($pdfPath, 17)
    Write-Output ("Pages=" + $doc.ComputeStatistics(2))
    Write-Output ("TOCs=" + $doc.TablesOfContents.Count)
    Write-Output ("Fields=" + $doc.Fields.Count)
}
finally {
    if ($null -ne $doc) {
        $doc.Close($false)
    }
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
