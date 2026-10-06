# Activity Tracker — desktop shortcut setup
# Run this ONCE from PowerShell to create the desktop shortcut with icon.
# Right-click this file → "Run with PowerShell"

$appDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbs      = Join-Path $appDir "start.vbs"
$ico      = Join-Path $appDir "icon.ico"
$desktop  = [Environment]::GetFolderPath("Desktop")
$shortcut = Join-Path $desktop "Activity Tracker.lnk"

$shell = New-Object -ComObject WScript.Shell
$lnk   = $shell.CreateShortcut($shortcut)

$lnk.TargetPath       = "wscript.exe"
$lnk.Arguments        = "`"$vbs`""
$lnk.WorkingDirectory = $appDir
$lnk.Description      = "Activity Tracker"
$lnk.IconLocation     = "$ico,0"
$lnk.Save()

Write-Host ""
Write-Host "✅ Shortcut created on your desktop: Activity Tracker" -ForegroundColor Green
Write-Host ""
Write-Host "Double-click it to start the app." -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close"
