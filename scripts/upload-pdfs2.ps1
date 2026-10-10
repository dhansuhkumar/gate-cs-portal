$ErrorActionPreference = 'Continue'
Set-Location D:\Gate\web-app
$log = 'D:\Gate\web-app\scripts\upload2.log'
"START $(Get-Date -Format o)" | Set-Content $log

$assets = @{}
((gh release view study-pdfs --json assets --jq '.assets[].name') -split "`n") | ForEach-Object { if ($_.Trim()) { $assets[$_.Trim()] = $true } }
"assets on release: $($assets.Count)" | Add-Content $log

function Get-AssetNames($name) {
  $dotted = ($name -replace ' ', '.') -replace '\.{2,}', '.'
  return @($name, $dotted)
}

$files = Get-ChildItem 'D:\Gate\web-app\pdfs' -Recurse -File -Filter *.pdf
$seen = @{}
$todo = @()
foreach ($f in $files) {
  if ($seen[$f.Name]) { continue }
  $found = $false
  foreach ($c in (Get-AssetNames $f.Name)) { if ($assets[$c]) { $found = $true; break } }
  if (-not $found) { $seen[$f.Name] = $true; $todo += $f }
}
$todo = $todo | Sort-Object Length
"UPLOADING $($todo.Count) files, {0:N0} MB" -f (($todo | Measure-Object Length -Sum).Sum / 1MB) | Add-Content $log

$i = 0; $lastHeartbeat = Get-Date
foreach ($f in $todo) {
  $i++
  $mb = [math]::Round($f.Length / 1MB, 1)
  "[$i/$($todo.Count)] $(Get-Date -Format 'HH:mm:ss') START $($f.Name) ($mb MB)" | Add-Content $log
  $ok = $false
  for ($try = 1; $try -le 4 -and -not $ok; $try++) {
    if ((Get-Date) - $lastHeartbeat -gt [TimeSpan]::FromMinutes(60)) { "HEARTBEAT $(Get-Date -Format o)" | Add-Content $log; $lastHeartbeat = Get-Date }
    $out = gh release upload study-pdfs "$($f.FullName)" --clobber 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) { $ok = $true }
    else { "  retry $try failed: $($out.Trim())" | Add-Content $log; Start-Sleep -Seconds 10 }
  }
  if ($ok) { "  DONE $(Get-Date -Format 'HH:mm:ss')" | Add-Content $log }
  else { "  FAILED permanently: $($f.Name)" | Add-Content $log }
}
"DONE $(Get-Date -Format o)" | Add-Content $log
