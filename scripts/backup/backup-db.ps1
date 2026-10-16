<#
.SYNOPSIS
    SureLog DB 를 파일 하나로 백업하고, 오래된 백업을 지운다.

.DESCRIPTION
    폐쇄망 PC 한 대의 Docker 볼륨에만 데이터가 있어, 디스크 고장이나 실수로 지우면 되살릴 수 없었다.
    pg_dump 의 custom 형식(-Fc)으로 떠서 한글이 콘솔 인코딩(CP949)에 깨지지 않는다.
    만든 파일은 컨테이너 안에서 pg_restore --list 로 읽어 보고, 읽히는 경우에만 남긴다.

    결과: <저장소>\backups\surelog_YYYYMMDD_HHmm.dump
    기록: <저장소>\backups\backup.log

    매일 자동으로 돌리려면 register-backup-task.ps1 을 한 번 실행한다.
    되살리는 방법은 docs\db-backup.md 를 본다.

.EXAMPLE
    .\scripts\backup\backup-db.ps1
    .\scripts\backup\backup-db.ps1 -KeepDays 30 -OutDir D:\surelog-backups
#>
[CmdletBinding()]
param(
    # 이 날수보다 오래된 백업 파일을 지운다
    [int]$KeepDays = 14,
    # 백업 파일을 둘 폴더. 비우면 <저장소>\backups
    [string]$OutDir = ""
)

$ErrorActionPreference = 'Stop'

# docker 는 진행 상황을 stderr 로 쓴다. PowerShell 5.1 은 리다이렉트될 때(예약 작업 등)
# 그 줄을 오류로 바꿔 스크립트를 멈추므로, 일반 출력으로 흘리고 종료 코드로만 판단한다.
function Invoke-Native {
    param([Parameter(Mandatory = $true)][scriptblock]$Command)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $Command 2>&1 | ForEach-Object { "$_" }
    }
    finally {
        $ErrorActionPreference = $previous
    }
}

# 이 스크립트는 <저장소>\scripts\backup 안에 있다. docker compose 는 저장소 폴더에서 돌아야 한다.
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repo
if ([string]::IsNullOrWhiteSpace($OutDir)) { $OutDir = Join-Path $repo 'backups' }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$log = Join-Path $OutDir 'backup.log'

function Write-Log([string]$message) {
    $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
    Write-Host $line
    Add-Content -Path $log -Value $line -Encoding UTF8
}

$stamp = Get-Date -Format 'yyyyMMdd_HHmm'
$target = Join-Path $OutDir "surelog_$stamp.dump"
$inner = '/tmp/surelog_backup.dump'

try {
    Write-Log "백업 시작"
    # $POSTGRES_USER·$POSTGRES_DB 는 컨테이너 안의 값이다 (작은따옴표라 PowerShell 이 풀지 않는다).
    $dump = 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f ' + $inner
    Invoke-Native { docker compose exec -T db sh -c $dump } | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "pg_dump 실패 (DB 컨테이너가 떠 있는지 확인하세요)" }

    # 만든 파일이 실제로 읽히는지 확인한다. 읽히지 않는 백업은 없는 것과 같다.
    $check = 'pg_restore --list ' + $inner + ' | grep -c "TABLE DATA"'
    $tables = (Invoke-Native { docker compose exec -T db sh -c $check } | Select-Object -Last 1)
    if ($LASTEXITCODE -ne 0 -or [int]$tables -lt 1) { throw "백업 파일을 읽을 수 없습니다" }

    Invoke-Native { docker cp "cowork_db:$inner" $target } | Out-Null
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $target)) { throw "백업 파일을 꺼내지 못했습니다" }
    Invoke-Native { docker compose exec -T db rm -f $inner } | Out-Null

    $sizeMb = [math]::Round((Get-Item $target).Length / 1MB, 2)
    Write-Log "백업 완료: $target ($sizeMb MB, 테이블 $tables 개)"

    $limit = (Get-Date).AddDays(-$KeepDays)
    $old = Get-ChildItem -Path $OutDir -Filter 'surelog_*.dump' | Where-Object { $_.LastWriteTime -lt $limit }
    foreach ($file in $old) {
        Remove-Item $file.FullName -Force
        Write-Log "오래된 백업 삭제: $($file.Name)"
    }
}
catch {
    Write-Log "백업 실패: $($_.Exception.Message)"
    if (Test-Path $target) { Remove-Item $target -Force }
    exit 1
}
