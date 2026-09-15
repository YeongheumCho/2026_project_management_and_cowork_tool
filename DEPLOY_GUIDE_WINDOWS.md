# Windows 배포 가이드

Windows에서 이 서비스를 처음 띄우는 방법입니다. Docker를 써 본 적 없어도 따라 할 수 있게 썼습니다.

> [!TIP]
> 이미 설치가 끝났다면 [Quick Start](#팀원-온보딩-요약-quick-start)와 [개발 워크플로우](#개발-워크플로우)만 보면 됩니다.

## 목차

| 단계 | 내용 |
|---|---|
| [1단계](#1단계-사전-준비-rancher-desktop-설치) | WSL 2 · Rancher Desktop 설치 |
| [2단계](#2단계-프로젝트-폴더로-이동) | 프로젝트 폴더로 이동 |
| [3단계](#3단계-환경-변수-파일-설정) | `.env` 작성 |
| [4단계](#4단계-서비스-빌드-및-실행) | 빌드하고 실행 |
| [5단계](#5단계-접속-확인) | 접속 확인 |
| [명령어](#자주-쓰는-명령어-모음) | 자주 쓰는 명령어 |
| [문제 해결](#자주-발생하는-문제와-해결법) | 안 될 때 |
| [Quick Start](#팀원-온보딩-요약-quick-start) | 요약 |
| [개발 워크플로우](#개발-워크플로우) | 코드 고치며 개발하기 |

이 문서는 **2026 프로젝트 관리 & 협업 툴**을 Windows PC의 PowerShell 환경에서 배포하는 전체 과정을 안내합니다.

서비스 구성과 기능 소개는 [README](./README.md)에 있습니다.

---

## 1단계: 사전 준비 (Rancher Desktop 설치)

<details open>
<summary><strong>펼쳐 보기</strong></summary>


이 프로젝트는 **Docker Compose**로 모든 서비스를 한 번에 띄우므로, 컨테이너 런타임만 설치하면 됩니다. Python, Node.js 등을 별도로 설치할 필요가 없습니다.

> **왜 Docker Desktop이 아닌가요?**
> Docker Desktop은 직원 250명 이상 또는 연 매출 $10M 이상인 회사에서 유료 구독이 필요합니다.
> **Rancher Desktop**은 SUSE에서 제공하는 완전 무료/오픈소스 대안으로, 상업적 사용에 제한이 없습니다.

### 1-1. WSL 2 설치 (필수 선행)

PowerShell을 **관리자 권한**으로 열고 실행합니다:

```powershell
wsl --install
```

이미 설치되어 있다면 "이미 설치됨" 메시지가 나옵니다. 새로 설치했다면 **재부팅**이 필요합니다.

재부팅 후 WSL이 정상 설치되었는지 확인합니다:

```powershell
wsl --version
```

### 1-2. Rancher Desktop 설치

1. https://rancherdesktop.io/ 에 접속
2. **"Download for Windows"** 클릭하여 MSI 설치 파일 다운로드
3. 다운로드된 `Rancher.Desktop.Setup.X.Y.Z.msi` 파일을 실행
4. 라이선스 동의 후 설치 진행 (Privileged Service 설치를 허용해주세요)
5. 설치 완료 후 Rancher Desktop 실행

### 1-3. Rancher Desktop 초기 설정 (중요!)

Rancher Desktop을 처음 실행하면 설정 화면이 나옵니다. 아래와 같이 설정합니다:

1. **Container Engine** 항목에서 **dockerd (moby)** 를 선택합니다
   - 이것이 핵심입니다! 이 옵션을 선택해야 `docker` 및 `docker compose` 명령어를 그대로 사용할 수 있습니다
   - containerd를 선택하면 docker compose가 동작하지 않습니다
2. **Kubernetes** 는 이 프로젝트에서 사용하지 않으므로 **비활성화(체크 해제)** 해도 됩니다
3. 설정이 완료되면 Rancher Desktop이 WSL 2 위에 가상 머신을 생성합니다 (1~3분 소요)

### 1-4. Docker 정상 동작 확인

Rancher Desktop이 완전히 시작된 후 (시스템 트레이에 아이콘이 뜨면) PowerShell을 **새로** 열고:

```powershell
docker --version
docker compose version
```

각각 버전 정보가 출력되면 정상입니다. 만약 "command not found" 에러가 나온다면:

- Rancher Desktop이 실행 중인지 확인하세요 (시스템 트레이에서 Rancher 아이콘 확인)
- PowerShell을 닫고 새로 열어보세요 (PATH가 갱신되어야 합니다)
- Rancher Desktop > Preferences > Application > PATH에서 "Manual" 대신 "Automatic"이 선택되어 있는지 확인하세요

---

</details>

---

## 2단계: 프로젝트 폴더로 이동

PowerShell에서 프로젝트가 있는 폴더로 이동합니다:

```powershell
cd "C:\경로\2026_project_management_and_cowork_tool"
```

> 본인의 실제 프로젝트 경로를 넣으세요. 탐색기에서 폴더를 열고 주소창을 클릭하면 전체 경로를 복사할 수 있습니다.

---

## 3단계: 환경 변수 파일 설정

### 3-1. .env 파일 생성

프로젝트 루트에 `.env.example` 파일이 있습니다. 이것을 복사하여 `.env` 파일을 만듭니다:

```powershell
Copy-Item .env.example .env
```

### 3-2. .env 파일 수정

메모장으로 열어 수정합니다:

```powershell
notepad .env
```

**반드시 변경해야 할 항목:**

```env
# 데이터베이스 비밀번호 (자유롭게 설정)
POSTGRES_PASSWORD=MySecurePassword123!
DATABASE_URL=postgresql+psycopg2://cowork_user:MySecurePassword123!@db:5432/cowork_db

# 백엔드 시크릿 키 (아무 긴 문자열)
SECRET_KEY=my-super-secret-key-change-this-to-random-string

# AI 챗봇용 API 키 (사용할 서비스에 맞게 설정)
# OpenAI를 사용할 경우:
OPENAI_API_KEY=sk-여기에-실제-API키-입력

# 또는 Anthropic을 사용할 경우:
ANTHROPIC_API_KEY=sk-ant-여기에-실제-API키-입력
```

> SECRET_KEY는 PowerShell에서 랜덤 문자열을 생성할 수 있습니다:
> ```powershell
> -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
> ```

나머지 항목(POSTGRES_HOST, REDIS_URL 등)은 Docker 내부 네트워크용이므로 **기본값 그대로** 두면 됩니다.

수정이 끝나면 메모장에서 저장(Ctrl+S)하고 닫습니다.

---

## 4단계: 서비스 빌드 및 실행

### 4-1. 프로덕션 모드로 실행

```powershell
docker compose up --build
```

처음 실행 시 Docker 이미지를 다운로드하고 빌드하므로 **5~15분** 정도 소요됩니다. 아래와 같은 로그가 보이면 정상입니다:

```
cowork_db        | database system is ready to accept connections
cowork_redis     | Ready to accept connections
cowork_backend   | Uvicorn running on http://0.0.0.0:8000
cowork_realtime  | Uvicorn running on http://0.0.0.0:8001
cowork_ai_chatbot| Uvicorn running on http://0.0.0.0:8002
cowork_frontend  | Ready on http://0.0.0.0:3000
```

### 4-2. 개발 모드로 실행 (코드 수정 시 자동 반영)

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### 4-3. 백그라운드에서 실행 (터미널을 닫아도 유지)

```powershell
docker compose up --build -d
```

`-d` 플래그는 "detached" 모드로, 백그라운드에서 실행됩니다.

---

## 5단계: 접속 확인

모든 서비스가 시작된 후 브라우저에서 접속합니다:

| 주소 | 설명 |
|---|---|
| http://localhost | **메인 화면.** Caddy가 프론트엔드로 넘겨준다 |
| http://localhost:3000 | 프론트엔드 직접 접속. Caddy 없이 확인할 때만 쓴다 |
| http://localhost:8000/docs | 백엔드 Swagger UI. API를 직접 호출해 볼 수 있다 |
| http://localhost:8001/docs | 실시간 서버 API 문서 |
| http://localhost:8002/docs | AI 챗봇 API 문서 |

> [!NOTE]
> 평소에는 **http://localhost** 만 쓰면 됩니다.
> 3000 포트 직접 접속은 간헐적으로 연결이 끊기는 경우가 있어 권하지 않습니다.

---

## 자주 쓰는 명령어 모음

### 서비스 상태 확인

```powershell
docker compose ps
```

### 특정 서비스 로그 보기

```powershell
docker compose logs backend        # 백엔드 로그
docker compose logs frontend       # 프론트엔드 로그
docker compose logs -f backend     # 실시간 로그 (-f: follow)
```

### 서비스 중지

```powershell
docker compose down
```

### 서비스 중지 + DB 데이터 삭제 (초기화)

```powershell
docker compose down -v
```

> [!CAUTION]
> `-v` 는 볼륨(DB 데이터)까지 삭제합니다. DB를 완전히 초기화하고 싶을 때만 쓰세요.

### 특정 서비스만 재빌드

```powershell
docker compose up --build backend      # 백엔드만 재빌드 후 실행
docker compose up --build frontend     # 프론트엔드만 재빌드 후 실행
```

---

## 자주 발생하는 문제와 해결법

> [!NOTE]
> 제목을 눌러 펼쳐 보세요.


<details>
<summary><strong><b>"docker: command not found" 또는 "Cannot connect to the Docker daemon" 에러</b></strong></summary>


Rancher Desktop이 실행 중인지 확인하세요. 시스템 트레이(화면 우측 하단)에서 Rancher 아이콘을 찾아보세요. 없다면 시작 메뉴에서 Rancher Desktop을 실행합니다. 실행 후 완전히 시작될 때까지 1~2분 기다린 후 PowerShell을 새로 여세요.

</details>

<details>
<summary><strong><b>"port is already allocated" 에러</b></strong></summary>


해당 포트를 이미 다른 프로그램이 사용 중입니다. 어떤 프로그램인지 확인하려면:

```powershell
netstat -ano | findstr :8000
```

출력된 PID(마지막 숫자)로 프로세스를 확인합니다:

```powershell
tasklist | findstr <PID번호>
```

해당 프로그램을 종료하거나 `.env`에서 포트를 변경하세요.

</details>

<details>
<summary><strong><b>"WSL 2 installation is incomplete" 에러</b></strong></summary>


```powershell
wsl --update
```

실행 후 PC를 재부팅합니다.

</details>

<details>
<summary><strong><b>빌드 중 네트워크 에러 (npm install, pip install 실패)</b></strong></summary>


회사 방화벽이나 프록시 환경에서 발생할 수 있습니다. WSL 2 내부에서 프록시를 설정해야 합니다:

```powershell
wsl -d rancher-desktop
export HTTP_PROXY=http://프록시주소:포트
export HTTPS_PROXY=http://프록시주소:포트
```

또는 Rancher Desktop > Preferences > Application 에서 프록시 설정을 확인하세요.

</details>

<details>
<summary><strong><b>DB 연결 에러 (backend가 계속 재시작)</b></strong></summary>


DB 초기화가 늦어질 수 있습니다. docker-compose.yml에 이미 healthcheck가 설정되어 있으므로 1-2분 기다리면 자동으로 연결됩니다. 그래도 안 되면:

```powershell
docker compose down -v
docker compose up --build
```

</details>

<details>
<summary><strong><b>빌드 중 `invalid file request node_modules/.bin/acorn`</b></strong></summary>


Windows 심볼릭 링크 문제다. 각 서비스의 `.dockerignore` 가 `node_modules` 를 제외하고 있지만, 그래도 나면 호스트 쪽을 지우고 다시 빌드한다.

```powershell
Remove-Item -Recurse -Force frontend/node_modules
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

</details>

<details>
<summary><strong><b>`column users.role does not exist` 같은 에러</b></strong></summary>


과거 스키마로 만든 테이블이 남아 있다. 개발 중이면 볼륨을 지우고 다시 올린다.

```powershell
docker compose down -v
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

</details>

<details>
<summary><strong><b>저장해도 화면에 반영되지 않음</b></strong></summary>


Windows 파일 변경이 WSL 2 로 전달되지 않는 경우다. `frontend/next.config.ts` 에 `webpack → watchOptions: { poll: 1000 }` 을 추가해 보거나, `docker compose restart frontend` 로 강제 재시작한다.

</details>

<details>
<summary><strong><b>컨테이너 이름 충돌 (`container name is already in use`)</b></strong></summary>


교체 도중 끊겨 반쯤 바뀐 컨테이너가 남은 상태다. 전부 지우고 다시 올린다.

```powershell
docker compose down --remove-orphans
docker compose up -d --build
```

`down` 은 컨테이너만 지우고 이름 있는 볼륨은 남기므로 DB 내용은 사라지지 않는다. `down -v` 는 볼륨까지 지우니 쓰지 않는다.

</details>

## 팀원 온보딩 요약 (Quick Start)

새 팀원이 이 가이드를 받았을 때, 최소한으로 실행하는 방법:

```powershell
# 1. WSL 2 설치 (관리자 PowerShell): wsl --install → 재부팅
# 2. Rancher Desktop 설치 (https://rancherdesktop.io/) → Container Engine: dockerd (moby) 선택
# 3. 프로젝트 폴더로 이동
cd "C:\경로\2026_project_management_and_cowork_tool"

# 4. 환경변수 설정
Copy-Item .env.example .env
notepad .env    # POSTGRES_PASSWORD, SECRET_KEY, API 키 수정 후 저장

# 5. 실행
docker compose up --build

# 6. 브라우저에서 http://localhost 접속
```

---

## 개발 워크플로우

컨테이너를 띄워둔 채 코드를 고치면 바로 반영되게 하는 흐름이다.

### 개발 모드로 기동

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

두 파일을 매번 타이핑하기 번거로우면 PowerShell 프로필에 별칭을 등록한다.

```powershell
function dcdev { docker compose -f docker-compose.yml -f docker-compose.dev.yml @args }
# 이후 dcdev up --build / dcdev logs -f frontend
```

### 무엇이 바로 반영되나

| 고친 것 | 바로 반영 | 아니라면 할 일 |
|---|---|---|
| `frontend/app/**/*.tsx` | 예 (HMR) | - |
| `frontend/app/globals.css`, Tailwind 클래스 | 예 | - |
| `frontend/package.json` | 아니오 | `dcdev build frontend` 후 재기동 |
| `backend/app/**/*.py` | 예 (uvicorn --reload, 1~3초) | Swagger 새로고침 |
| `backend/requirements.txt` | 아니오 | `docker compose build backend` 후 `up` |
| `backend/app/models/**.py` | 재시작만 됨 | 아래 "DB 스키마를 바꿨을 때" 참조 |
| `docker-compose*.yml`, `Dockerfile` | 아니오 | `up --build` |
| `.env` | 아니오 | `docker compose restart` |

### 고친 뒤 확인하기

프론트엔드는 브라우저 콘솔에 빨간 에러가 없는지 보고, 타입이 의심되면 호스트에서 확인한다.

```powershell
cd frontend
npx tsc --noEmit
npm run lint
```

백엔드는 로그에 `Application startup complete.` 가 다시 뜨는지 보고, http://localhost:8000/docs 에서 엔드포인트를 확인한다.

```powershell
docker compose logs -f backend
cd backend
pytest
```

### DB 스키마를 바꿨을 때

테이블은 `Base.metadata.create_all()` 로 최초 1회만 만들어진다. 컬럼을 더하거나 지우면 기존 테이블은 그대로 남아 `column X does not exist` 에러가 난다.

간단한 컬럼 추가는 `backend/app/main.py` 의 시작 시 마이그레이션에 `ALTER TABLE ... ADD COLUMN` 한 줄을 더하는 방식으로 처리해 왔다. 기존 데이터를 지우지 않아도 된다.

개발 중이고 데이터를 버려도 되면 볼륨째 초기화한다.

```powershell
docker compose down -v
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

> [!CAUTION]
> `-v` 는 PostgreSQL 데이터 볼륨을 완전히 지웁니다. 남길 데이터가 있으면 먼저 백업하세요.
> 운영에서는 Alembic 마이그레이션으로 옮겨가야 한다. 설정만 되어 있고 아직 쓰지 않는다.

### 컨테이너 안에서 확인하기

```powershell
# 파이썬 대화형으로 DB 조회
docker compose exec backend python
>>> from app.db import SessionLocal
>>> from app.models.project import SubProject
>>> SessionLocal().query(SubProject).all()

# DB 직접 조회
docker compose exec db psql -U cowork_user -d cowork_db
cowork_db=# \dt
cowork_db=# SELECT id, name, status FROM subprojects LIMIT 10;
```
