param(
  [string]$SshAlias = "smartprogress-studio",
  [string]$RemoteBackupPath = "/home/ubuntu/smartprogress/backups",
  [string]$LocalBackupRoot = "$env:USERPROFILE\Desktop\smartprogress-db-backups",
  [int]$KeepLocalDays = 90,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "==> $Message"
}

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found. Install OpenSSH Client or run this from a shell where '$Name' is available."
  }
}

$mirrorDir = Join-Path $LocalBackupRoot "server-backups"
$remoteSpec = "${SshAlias}:$RemoteBackupPath/*"

Write-Step "Preparing local backup folder"
if ($DryRun) {
  Write-Host "Would create: $mirrorDir"
} else {
  New-Item -ItemType Directory -Force -Path $mirrorDir | Out-Null
}

Write-Step "Checking required commands"
Require-Command "ssh"
Require-Command "scp"

Write-Step "Checking remote backup folder"
$remoteCheck = "test -d '$RemoteBackupPath' && find '$RemoteBackupPath' -maxdepth 1 \( -type f -o -type d \) | wc -l"
if ($DryRun) {
  Write-Host "Would run: ssh $SshAlias $remoteCheck"
} else {
  & ssh $SshAlias $remoteCheck
}

Write-Step "Copying remote backups to local mirror"
if ($DryRun) {
  Write-Host "Would run: scp -r $remoteSpec $mirrorDir"
} else {
  & scp -r $remoteSpec $mirrorDir
}

Write-Step "Removing old local nightly backup files older than $KeepLocalDays days"
$cutoff = (Get-Date).AddDays(-$KeepLocalDays)
$nightlyPatterns = @("smartprogress-*.sql.gz", "smartprogress-*.dump", "schema-only-*.sql")
foreach ($pattern in $nightlyPatterns) {
  $oldFiles = Get-ChildItem -Path $mirrorDir -Filter $pattern -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt $cutoff }

  foreach ($file in $oldFiles) {
    if ($DryRun) {
      Write-Host "Would remove local old nightly backup: $($file.FullName)"
    } else {
      Remove-Item -LiteralPath $file.FullName -Force
    }
  }
}

Write-Step "Backup sync complete"
if (-not $DryRun) {
  Get-ChildItem -Path $mirrorDir -Force |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 20 Name, Length, LastWriteTime |
    Format-Table -AutoSize
}
