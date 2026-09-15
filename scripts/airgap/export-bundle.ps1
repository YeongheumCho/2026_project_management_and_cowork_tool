<#
.SYNOPSIS
    폐쇄망으로 옮길 배포 묶음을 만든다. 인터넷이 되는 PC 에서 실행한다.

.DESCRIPTION
    폐쇄망에서는 npm·pip 를 받을 수 없어 빌드가 불가능하다.
    그래서 다 만들어진 도커 이미지를 통째로 싣고 간다.

    모드
      Update  이미 설치된 폐쇄망을 갱신할 때. 만든 이미지 4개 + 소스   (기본값)
      Full    빈 PC 에 처음 설치할 때. 공식 이미지 3개까지 포함

    소스만 바뀌고 의존성이 그대로면 Update 로 충분하다.
    requirements.txt·package-lock.json·Dockerfile 이 바뀌었는지 자동으로 확인해 알려준다.

.EXAMPLE
    .\scripts\airgap\export-bundle.ps1
    .\scripts\airgap\export-bundle.ps1 -Mode Full -OutDir D:\bundle
    .\scripts\airgap\export-bundle.ps1 -SinceRef 1cf0718      # 폐쇄망에 반영된 커밋
#>
[CmdletBinding()]
param(
    [ValidateSet('Update', 'Full')]
    [string]$Mode = 'Update',
    # 묶음을 만들 위치. 기본값은 저장소 옆의 surelog-bundle-날짜
    [string]$OutDir = "",
    # 폐쇄망에 이미 반영된 커밋. 무엇이 바뀌었는지 비교하는 데만 쓴다
    [string]$SinceRef = "",
    # 이미 빌드된 이미지를 그대로 쓴다
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repo

$stamp = Get-Date -Format 'yyMMdd'
if ([string]::IsNullOrWhiteSpace($OutDir)) {
    $OutDir = Join-Path (Split-Path $repo -Parent) "surelog-bundle-$stamp"
}

# 빌드해서 만드는 이미지. 소스가 바뀌면 프론트엔드는 반드시 다시 만들어야 한다.
# 백엔드·실시간·챗봇은 소스를 컨테이너에 마운트하므로 의존성이 바뀔 때만 영향을 받는다.
$BUILT = @(
    'surelog-frontend:latest',
    'surelog-backend:latest',
    'surelog-realtime:latest',
    'surelog-ai-chatbot:latest'
)
$OFFICIAL = @('postgres:16-alpine', 'redis:7-alpine', 'caddy:2-alpine')

$images = $BUILT
if ($Mode -eq 'Full') { $images = $BUILT + $OFFICIAL }

Write-Host "모드     : $Mode" -ForegroundColor Cyan
Write-Host "묶음 위치: $OutDir" -ForegroundColor Cyan

# ── 의존성이 바뀌었는지 확인 ──────────────────────────────────────
if (-not [string]::IsNullOrWhiteSpace($SinceRef)) {
    Write-Host "`n[확인] $SinceRef 이후 변경" -ForegroundColor Cyan
    $depFiles = @(
        'backend/requirements.txt', 'realtime/requirements.txt', 'ai-chatbot/requirements.txt',
        'frontend/package.json', 'frontend/package-lock.json',
        'backend/Dockerfile', 'realtime/Dockerfile', 'ai-chatbot/Dockerfile', 'frontend/Dockerfile',
        'docker-compose.yml', 'Caddyfile'
    )
    $changed = @()
    foreach ($f in $depFiles) {
        git -C $repo diff --quiet $SinceRef HEAD -- $f 2>$null
        if ($LASTEXITCODE -ne 0) { $changed += $f }
    }
    $global:LASTEXITCODE = 0
    if ($changed.Count -eq 0) {
        Write-Host "  의존성·설정 변경 없음. Update 모드로 충분합니다." -ForegroundColor Green
    }
    else {
        Write-Host "  아래 파일이 바뀌었습니다:" -ForegroundColor Yellow
        foreach ($f in $changed) { Write-Host "    $f" -ForegroundColor Yellow }
        Write-Host "  이미지를 다시 빌드해서 싣습니다." -ForegroundColor Yellow
    }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# ── 1. 이미지 준비 ────────────────────────────────────────────────
if (-not $SkipBuild) {
    Write-Host "`n[1/4] 이미지 빌드" -ForegroundColor Cyan
    docker compose build
    if ($LASTEXITCODE -ne 0) { throw "빌드 실패" }
    if ($Mode -eq 'Full') {
        Write-Host "공식 이미지 받기"
        docker compose pull db redis caddy
    }
}
else {
    Write-Host "`n[1/4] 빌드 건너뜀 (-SkipBuild)" -ForegroundColor Yellow
}

foreach ($img in $images) {
    if ([string]::IsNullOrWhiteSpace((docker images -q $img))) {
        throw "이미지가 없습니다: $img  (docker compose build 를 먼저 실행하세요)"
    }
}

# ── 2. 이미지 저장 ────────────────────────────────────────────────
Write-Host "`n[2/4] 이미지 저장 (수 분 걸립니다)" -ForegroundColor Cyan
$tar = Join-Path $OutDir 'images.tar'
docker save -o $tar $images
if ($LASTEXITCODE -ne 0) { throw "docker save 실패" }
$tarGB = [math]::Round((Get-Item $tar).Length / 1GB, 2)
Write-Host "  images.tar  $tarGB GB  ($($images.Count) 개)"

# ── 3. 소스 복사 ──────────────────────────────────────────────────
Write-Host "`n[3/4] 소스 복사" -ForegroundColor Cyan
$src = Join-Path $OutDir 'source'
New-Item -ItemType Directory -Force -Path $src | Out-Null

# 빌드 산출물·이력·비밀은 뺀다
$roboArgs = @($repo, $src, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1',
              '/XD', 'node_modules', '.next', '.git', '__pycache__', '.pytest_cache',
                     'venv', '.venv', 'backups', 'uploads',
              '/XF', '*.bundle', '*.pyc', 'tsconfig.tsbuildinfo', '.env')
robocopy @roboArgs | Out-Null
if ($LASTEXITCODE -ge 8) { throw "소스 복사 실패 (robocopy $LASTEXITCODE)" }
$global:LASTEXITCODE = 0

$srcMB = [math]::Round((Get-ChildItem $src -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 1)
Write-Host "  source/  $srcMB MB"

# ── 4. 매니페스트 ─────────────────────────────────────────────────
Write-Host "`n[4/4] 매니페스트 작성" -ForegroundColor Cyan
$branch = (git -C $repo rev-parse --abbrev-ref HEAD 2>$null)
$commit = (git -C $repo rev-parse --short HEAD 2>$null)
$dirty  = (git -C $repo status --porcelain 2>$null)
$dirtyNote = '없음'
if (-not [string]::IsNullOrWhiteSpace($dirty)) {
    $dirtyNote = "있음 ($((($dirty -split "`n") | Where-Object { $_ }).Count) 개 파일)"
}

$lines = @(
    "SureLog AI 폐쇄망 배포 묶음",
    "",
    "모드      : $Mode",
    "만든 날짜 : $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
    "만든 PC   : $env:COMPUTERNAME",
    "브랜치    : $branch",
    "커밋      : $commit",
    "미커밋 변경: $dirtyNote",
    "",
    "포함 이미지"
)
foreach ($img in $images) {
    $id = (docker images --format '{{.ID}}' $img | Select-Object -First 1)
    $sz = (docker images --format '{{.Size}}' $img | Select-Object -First 1)
    $lines += ("  {0,-30} {1,-14} {2}" -f $img, $id, $sz)
}
if ($Mode -eq 'Update') {
    $lines += @("", "postgres·redis·caddy 는 넣지 않았습니다. 폐쇄망에 이미 있는 것을 씁니다.")
}
$lines += @(
    "",
    "폐쇄망에서 할 일",
    "  1. 이 폴더를 통째로 복사",
    "  2. source\scripts\airgap\import-bundle.ps1 실행",
    "  3. 자세한 절차는 source\docs\airgap-deploy.md"
)
$lines -join "`r`n" | Set-Content (Join-Path $OutDir 'MANIFEST.txt') -Encoding utf8

Write-Host "`n완료" -ForegroundColor Green
Write-Host "  $OutDir"
Write-Host "  images.tar $tarGB GB + source $srcMB MB"
Write-Host "`n이 폴더를 그대로 폐쇄망으로 옮기세요."
