$ErrorActionPreference = 'Continue'
Set-Location D:\Gate\web-app
$log = 'D:\Gate\web-app\scripts\upload-progress.log'
"START $(Get-Date -Format o)" | Set-Content $log

$assets = (gh release view study-pdfs --json assets --jq '.assets[].name') -split "`n"
$existing = @{}
foreach ($a in $assets) { if ($a.Trim()) { $existing[$a.Trim()] = $true } }
"already on release: $($existing.Count)" | Add-Content $log

$files = Get-ChildItem 'D:\Gate\web-app\pdfs' -Recurse -File -Filter *.pdf
$seen = @{}
$todo = @()
foreach ($f in $files) {
  if (-not $existing[$f.Name] -and -not $seen[$f.Name]) { $seen[$f.Name] = $true; $todo += $f }
}
$todo = $todo | Sort-Object Length
"UPLOADING $($todo.Count) files" | Add-Content $log

$i = 0
foreach ($f in $todo) {
  $i++
  $mb = [math]::Round($f.Length / 1MB, 1)
  "[$i/$($todo.Count)] $(Get-Date -Format 'HH:mm:ss') $($f.Name) ($mb MB)" | Add-Content $log
  $ok = $false
  for ($try = 1; $try -le 3 -and -not $ok; $try++) {
    $out = gh release upload study-pdfs "$($f.FullName)" --clobber 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) { $ok = $true }
    else { "  retry $try failed for $($f.Name): $($out.Trim())" | Add-Content $log; Start-Sleep -Seconds 5 }
  }
  if (-not $ok) { "  FAILED permanently: $($f.Name)" | Add-Content $log }
}
"DONE $(Get-Date -Format o)" | Add-Content $log
