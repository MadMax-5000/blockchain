# Capture d'écrans de démonstration (Chrome headless)
# Usage : .\scripts\screenshots.ps1   (le serveur preview doit tourner sur le port 4173)

$ErrorActionPreference = "Stop"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$out = Join-Path $PSScriptRoot "..\docs\screenshots"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$pages = @(
  @{ name = "01-accueil.png"; url = "http://localhost:4173/" },
  @{ name = "02-admin.png"; url = "http://localhost:4173/admin" },
  @{ name = "03-verify-id.png"; url = "http://localhost:4173/verify?q=1" },
  @{ name = "04-verify-student.png"; url = "http://localhost:4173/verify?q=2023-INF-042" },
  @{ name = "05-audit.png"; url = "http://localhost:4173/audit" }
)

foreach ($page in $pages) {
  $target = Join-Path $out $page.name
  & $chrome --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
    --window-size=1440,1000 --virtual-time-budget=9000 `
    --screenshot="$target" $page.url 2>$null | Out-Null
  if (Test-Path $target) {
    Write-Host "OK  $($page.name)"
  } else {
    Write-Host "ECHEC $($page.name)"
  }
}
