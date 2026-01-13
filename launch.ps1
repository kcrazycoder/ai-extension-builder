
$chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
$extPath = "C:\Users\razu_\AppData\Local\Temp\ai-ext-preview"
$profilePath = "C:\Users\razu_\AppData\Local\Temp\ai-ext-profile"

# Verify Paths
if (-not (Test-Path -Path $extPath)) {
    Write-Host "ERROR: Extension Path NOT FOUND!"
    exit 1
}

# Create Profile Dir if needed
if (-not (Test-Path -Path $profilePath)) {
    New-Item -ItemType Directory -Force -Path $profilePath | Out-Null
}

$argsStr = "--load-extension=`"$extPath`" --user-data-dir=`"$profilePath`" --no-first-run --no-default-browser-check --disable-gpu --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --remote-allow-origins=* about:blank"

# Launch and capture PID
# Use single string argument to avoid array joining issues
$process = Start-Process -FilePath $chromePath -ArgumentList $argsStr -PassThru
Write-Host "CHROME_PID:$($process.Id)"
