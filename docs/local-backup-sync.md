# Local backup sync

The production server already creates PostgreSQL backups under:

```text
/home/ubuntu/smartprogress/backups
```

Use the PowerShell helper below to copy those backup files to this Windows machine without touching the server database or Docker volumes.

## Manual sync

Run from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-prod-backups.ps1
```

Default local destination:

```text
%USERPROFILE%\Desktop\smartprogress-db-backups\server-backups
```

Dry run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-prod-backups.ps1 -DryRun
```

## Daily Windows automation

Run once in PowerShell from the repository root:

```powershell
$script = (Resolve-Path .\scripts\sync-prod-backups.ps1).Path
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Daily -At 03:00
Register-ScheduledTask -TaskName "SmartProgress DB Backup Sync" -Action $action -Trigger $trigger -Description "Copies production DB backups from smartprogress-studio to this PC."
```

The task uses the existing SSH alias `smartprogress-studio`, so the SSH config must keep working on this Windows account.

## Retention behavior

- Server retention is controlled by `backups/backup.sh`.
- Local retention defaults to 90 days for nightly files copied by this script.
- Manual safety backup folders such as `manual-before-*` are copied but not cleaned by this script.
