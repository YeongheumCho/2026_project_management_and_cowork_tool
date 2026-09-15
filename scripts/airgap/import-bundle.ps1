<#
.SYNOPSIS
    폐쇄망에서 배포 묶음을 풀어 서비스를 올린다.

.DESCRIPTION
    처음 설치와 갱신 모두 같은 절차다.
    데이터베이스 볼륨(postgres_data)은 건드리지 않으므로 기존 데이터는 그대로 남는다.

    하는 일
      1. 실어 온 이미지 적재
      2. DB 백업 (갱신일 때만)
      3. 소스 덮어쓰기 (.env·uploads·backups 는 보존)
      4. 컨테이너 재생성

.EXAMPLE
    .\import-bundle.ps1
    .\import-bundle.ps1 -TargetDir C:\surelog -BundleDir D:\surelog-bundle-260915
    .\import-bundle.ps1 -LoadOnly
#>
[CmdletBinding()]
param(
    # images.tar 와 source/ 가 있는 폴더
    [string]$BundleDir = "",
    # 서비스가 설치된(또는 설치할) 위치
    [string]$TargetDir = "",
    # 이미지만 적재하고 멈춘다
    [switch]$LoadOnly,
    # DB 백업을 건너뛴다
    [switch]$SkipBackup
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($BundleDir)) {
    # 이 스크립트는 source\scripts\airgap 안에 있으므로 세 단계 위가 묶음 폴더다
    $BundleDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
}
$tar = Join-Path $BundleDir 'images.tar'
$src = Join-Path $BundleDir 'source'

if (-not (Test-Path $tar)) { throw "images.tar 를 찾지 못했습니다: $tar" }
if (-not (Test-Path $src)) { throw "source 폴더를 찾지 못했습니다: $src" }

if ([string]::IsNullOrWhiteSpace($TargetDir)) {
    $TargetDir = Read-Host "설치된 폴더 경로를 입력하세요 (예: C:\surelog)"
}
$isUpdate = Test-Path (Join-Path $TargetDir 'docker-compose.yml')

Write-Host "묶음   : $BundleDir" -ForegroundColor Cyan
Write-Host "설치처 : $TargetDir" -ForegroundColor Cyan
if ($isUpdate) { Write-Host "방식   : 기존 설치 갱신" -ForegroundColor Cyan }
else           { Write-Host "방식   : 새로 설치" -ForegroundColor Cyan }

docker version --format '{{.Server.Version}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw "도커가 실행 중이 아닙니다. Rancher Desktop 을 먼저 켜세요." }

# ── 1. 이미지 적재 ────────────────────────────────────────────────
Write-Host "`n[1/5] 이미지 적재 (수 분 걸립니다)" -ForegroundColor Cyan
docker load -i $tar
if ($LASTEXITCODE -ne 0) { throw "docker load 실패" }

$required = @('surelog-frontend:latest', 'surelog-backend:latest',
              'surelog-realtime:latest', 'surelog-ai-chatbot:latest',
              'postgres:16-alpine', 'redis:7-alpine', 'caddy:2-alpine')
$missing = @()
foreach ($img in $required) {
    if ([string]::IsNullOrWhiteSpace((docker images -q $img))) { $missing += $img }
}
if ($missing.Count -gt 0) {
    Write-Host "`n이 PC 에 없는 이미지가 있습니다:" -ForegroundColor Red
    foreach ($m in $missing) { Write-Host "  $m" -ForegroundColor Red }
    throw "Full 모드로 만든 묶음이 필요합니다. (export-bundle.ps1 -Mode Full)"
}

if ($LoadOnly) {
    Write-Host "`n이미지만 적재했습니다 (-LoadOnly)." -ForegroundColor Green
    return
}

# ── 2. DB 백업 ────────────────────────────────────────────────────
if ($isUpdate -and -not $SkipBackup) {
    Write-Host "`n[2/5] DB 백업" -ForegroundColor Cyan
    Push-Location $TargetDir
    $running = docker compose ps --format '{{.Name}}' 2>$null
    if ($running -match 'cowork_db') {
        $backupDir = Join-Path $TargetDir 'backups'
        New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
        $file = Join-Path $backupDir ("full_" + (Get-Date -Format 'yyMMdd_HHmm') + ".sql")
        docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | Out-File -FilePath $file -Encoding utf8
        if (Test-Path $file) {
            $mb = [math]::Round((Get-Item $file).Length / 1MB, 1)
            Write-Host "  $file  ($mb MB)"
        }
    }
    else {
        Write-Host "  DB 컨테이너가 꺼져 있어 건너뜁니다." -ForegroundColor Yellow
    }
    Pop-Location
}
else {
    Write-Host "`n[2/5] DB 백업 건너뜀" -ForegroundColor Yellow
}

# ── 3. 소스 배치 ──────────────────────────────────────────────────
Write-Host "`n[3/5] 소스 배치" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
# .env·업로드 파일·백업은 덮어쓰지 않는다
$roboArgs = @($src, $TargetDir, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1',
              '/XF', '.env', '/XD', 'uploads', 'backups')
robocopy @roboArgs | Out-Null
if ($LASTEXITCODE -ge 8) { throw "소스 복사 실패 (robocopy $LASTEXITCODE)" }
$global:LASTEXITCODE = 0
Write-Host "  완료 (.env, uploads, backups 는 유지)"

Set-Location $TargetDir

# ── 4. 환경 변수 ──────────────────────────────────────────────────
Write-Host "`n[4/5] 환경 변수 확인" -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $TargetDir '.env'))) {
    Copy-Item (Join-Path $TargetDir '.env.example') (Join-Path $TargetDir '.env')
    Write-Host "  .env 를 새로 만들었습니다." -ForegroundColor Yellow
    Write-Host "  POSTGRES_PASSWORD 와 SECRET_KEY 를 채운 뒤 이 스크립트를 다시 실행하세요." -ForegroundColor Yellow
    notepad (Join-Path $TargetDir '.env')
    return
}
Write-Host "  기존 .env 사용"

# ── 5. 기동 ───────────────────────────────────────────────────────
Write-Host "`n[5/5] 서비스 기동" -ForegroundColor Cyan
# --build 를 쓰지 않는다. 폐쇄망에서는 빌드가 불가능하고, 실어 온 이미지를 그대로 쓴다.
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n기동에 실패했습니다. 컨테이너 이름이 충돌하면 아래를 실행하세요:" -ForegroundColor Red
    Write-Host "  docker compose down --remove-orphans" -ForegroundColor Red
    Write-Host "  docker compose up -d" -ForegroundColor Red
    throw "docker compose up 실패"
}

Start-Sleep -Seconds 20
docker compose ps --format "table {{.Name}}`t{{.Status}}"

Write-Host "`n완료" -ForegroundColor Green
Write-Host "  이 PC 에서      http://localhost"
Write-Host "  다른 PC 에서    http://$env:COMPUTERNAME"
Write-Host ""
Write-Host "DB 스키마는 백엔드가 뜨면서 자동으로 맞춰집니다. 로그로 확인하세요:"
Write-Host "  docker compose logs --tail 30 backend"
Write-Host ""
Write-Host "쓰지 않는 옛 이미지를 지우려면:"
Write-Host "  docker image prune -f"
