# Yeni kurum dijital ikizi üretir (Windows).
# Örnek: powershell -File tenant-provisioner.ps1 -Name abc-holding -Subdomain abc.sistem.com -Display "ABC Holding"
param([Parameter(Mandatory=$true)][string]$Name, [Parameter(Mandatory=$true)][string]$Subdomain, [string]$Display = "", [string]$Mode = "offline")
$engine = Join-Path $PSScriptRoot "..\engine\src\provisioner.mjs"
$a = @("--no-warnings", $engine, "--name", $Name, "--subdomain", $Subdomain, "--mode", $Mode)
if ($Display) { $a += @("--display", $Display) }
& node @a
exit $LASTEXITCODE
