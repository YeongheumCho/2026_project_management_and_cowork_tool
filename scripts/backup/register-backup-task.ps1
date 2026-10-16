<#
.SYNOPSIS
    backup-db.ps1 을 매일 정해진 시각에 돌리도록 Windows 예약 작업에 등록한다.

.DESCRIPTION
    한 번만 실행하면 된다. 같은 이름의 작업이 있으면 새 설정으로 바꾼다.
    PC 가 꺼져 있어 시각을 놓치면, 다음에 켜졌을 때 바로 한 번 돈다.
    작업 이름: SureLog DB 백업

.EXAMPLE
    .\scripts\backup\register-backup-task.ps1
    .\scripts\backup\register-backup-task.ps1 -At 18:30 -KeepDays 30
#>
[CmdletBinding()]
param(
    # 매일 백업할 시각 (24시간제)
    [string]$At = '12:30',
    [int]$KeepDays = 14
)

$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'backup-db.ps1'
if (-not (Test-Path $script)) { throw "backup-db.ps1 을 찾지 못했습니다: $script" }

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -KeepDays $KeepDays" `
    -WorkingDirectory (Split-Path $script)
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName 'SureLog DB 백업' -Action $action -Trigger $trigger `
    -Settings $settings -Description 'SureLog DB 를 매일 backups 폴더에 백업한다 (scripts\backup\backup-db.ps1)' `
    -Force | Out-Null

Write-Host "예약 작업을 등록했습니다: 매일 $At, $KeepDays 일 보관" -ForegroundColor Green
Write-Host "확인: 작업 스케줄러에서 'SureLog DB 백업' 을 찾거나 아래를 실행하세요"
Write-Host "  Get-ScheduledTask -TaskName 'SureLog DB 백업'"
