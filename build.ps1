# Builds dist\BeKitzur-Setup-<version>.exe
#   1. icon + version resource   (packaging\make_assets.py)
#   2. standalone app folder     (PyInstaller -> dist\BeKitzur)
#   3. installer                 (Inno Setup -> dist\BeKitzur-Setup-<version>.exe)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$build = Join-Path $root "build"
$dist = Join-Path $root "dist"

$python = @(
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $python) { $python = (Get-Command python -ErrorAction SilentlyContinue).Source }
if (-not $python) { throw "Python 3.11+ not found." }

$iscc = @(
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw "Inno Setup 6 not found. Install it with: winget install JRSoftware.InnoSetup" }

Write-Output "== dependencies"
& $python -m pip install --quiet --disable-pip-version-check -r (Join-Path $root "requirements.txt") pyinstaller
if ($LASTEXITCODE -ne 0) { throw "pip install failed" }

Write-Output "== assets"
New-Item -ItemType Directory -Force $build | Out-Null
$meta = & $python (Join-Path $root "packaging\make_assets.py") $build | Select-Object -Last 2
if ($LASTEXITCODE -ne 0 -or $meta.Count -ne 2) { throw "asset generation failed" }
$author = $meta[0].Trim()
$version = $meta[1].Trim()
Write-Output "version $version by $author"

Write-Output "== pyinstaller"
& $python -m PyInstaller --noconfirm --clean --windowed `
    --name BeKitzur `
    --icon (Join-Path $build "shwordcut.ico") `
    --version-file (Join-Path $build "version_info.txt") `
    --distpath $dist `
    --workpath (Join-Path $build "pyinstaller") `
    --specpath $build `
    --log-level WARN `
    (Join-Path $root "run.pyw")
if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed" }

Write-Output "== installer"
# ISCC reads a BOM-less script as ANSI, which would mangle the Hebrew strings.
$iss = Join-Path $build "bekitzur.iss"
$text = [IO.File]::ReadAllText((Join-Path $root "packaging\bekitzur.iss"), [Text.Encoding]::UTF8)
[IO.File]::WriteAllText($iss, $text, (New-Object Text.UTF8Encoding $true))

& $iscc /Q `
    "/DAppVersion=$version" `
    "/DAppPublisher=$author" `
    "/DLicenseFile=$(Join-Path $root 'LICENSE')" `
    "/DSourceDir=$(Join-Path $dist 'BeKitzur')" `
    "/DOutputDir=$dist" `
    "/DIconFile=$(Join-Path $build 'shwordcut.ico')" `
    $iss
if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed" }

$setup = Join-Path $dist "BeKitzur-Setup-$version.exe"
$size = [math]::Round((Get-Item $setup).Length / 1MB, 1)
Write-Output ""
Write-Output "Built $setup ($size MB)"
