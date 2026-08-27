# AutoApply PowerShell Launcher
$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " AutoApply - Desktop Job Application Assistant" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Check Python executable
try {
    $pythonVersion = & python --version
    Write-Host "[Python] Found $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python was not found in PATH." -ForegroundColor Red
    Write-Host "Please ensure Python 3.10+ is installed."
    Read-Host "Press Enter to exit..."
    exit 1
}

# Create virtual environment if missing
if (-not (Test-Path ".venv")) {
    Write-Host "[1/3] Creating virtual environment (.venv)..." -ForegroundColor Yellow
    & python -m venv .venv
}

# Use venv python
$VenvPython = Join-Path $ScriptDir ".venv\Scripts\python.exe"

Write-Host "[2/3] Installing dependencies..." -ForegroundColor Yellow
& $VenvPython -m pip install --upgrade pip --quiet
& $VenvPython -m pip install -r requirements.txt

Write-Host "[3/3] Launching AutoApply GUI..." -ForegroundColor Green
Write-Host ""
& $VenvPython main.py
