# 2026 프로젝트 관리 & 협업 툴

Flow(flow.team)와 유사한 사내 업무 협업 도구. **KEFICO 5층 공식/정기/변경점 검증 및 기타 업무** 흐름에 맞춰 소프로젝트 단위로 일감을 추적한다.

## 구현된 기능 (현 시점)

**인증 · 팀원**
- 회원가입 / 로그인 (JWT)
- **관리자 / 일반 직원** 역할 구분 — 프로젝트·소프로젝트 생성/수정/삭제는 관리자만, 세부 태스크 체크는 담당자 본인도 가능

**프로젝트 & 소프로젝트**
- 프로젝트 유형 4종 + 일반: `공식 검증 / 정기 검증 / 변경점 검증 / 기타 업무 / 일반`
- 유형별 세부 태스크 템플릿 자동 생성
  - 검증 3종: `사전 준비 → 1차 검증 → Review 작성 → InReview 반영 → 업로드/완료`
  - 기타 업무: `계획 → 진행 → 정리`
  - 일반: `기획 → 분석 → 설계 → 구현 → 검증`
- 세부 태스크 체크 시 `progress` 자동 계산, 100%면 `completed`로 전이
- 완료된 소프로젝트는 삭제 불가, 종료일 < 시작일은 422로 거부

**KEFICO 필드 (소프로젝트)**
- 검증 공통 메타: 우선순위, 제어기명/버전/나라, TO번호/담당자, 검증 LEVEL (기초/LV1/LV2/BSW/LV3/LV4), 차종(HEV/PHEV/CN8 LV2 등), 기능명·담당, 검증자(verifier)·리뷰어(reviewer), 검증자리, 제어기번호, 평균 예상 소요(분), 특이사항, 이슈/진행상황, 업로드 완료 여부, 완료일
- 1차 검증 vs InReview 분리: 각 단계별 `검증 상태 (10단계 enum)` + 세팅(분) / AUD(분) / Review·Feedback(분) 입력, 합계 자동 표시
- 변경점 전용: CR.No, IP, 검토/피드백(분), 재검증(분), LIN/STD/HOLD→FAIL 메모
- 기타 업무 전용: 카테고리 (교육/휴가/출장/FAIL분류/기타), 월(YYYY-MM), 소요일, 비고

**대시보드 & 캘린더**
- 대시보드: 진행 중 소프로젝트 수, 오늘 마감 업무, 활성 팀원 수 KPI + 본인 담당 오늘 할 일 + 최근 5건
- 팀 캘린더: 전체 소프로젝트의 기간 바 (상태별 색상)
- 개인 캘린더: 담당자별 필터, 체크리스트 모달

## 서비스 구성

| 서비스 | 경로 | 포트 | 담당 |
|--------|------|------|------|
| Backend REST API | `./backend` | 8000 | 개발자 1 |
| Realtime Server (WebSocket) | `./realtime` | 8001 | 개발자 2 |
| Frontend (Next.js 15 + React 19) | `./frontend` | 3000 | 개발자 3 |
| AI Chatbot | `./ai-chatbot` | 8002 | 개발자 4 |
| PostgreSQL | - | 5432 | 개발자 3 (DB 관리) |
| Redis | - | 6379 | - |

## 기술 스택

- **Backend**: FastAPI (Python 3.11+), SQLAlchemy 2.0 (Mapped 스타일), Pydantic v2
- **Realtime**: FastAPI + WebSocket + Redis Pub/Sub
- **Frontend**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- **AI Chatbot**: FastAPI + LLM API
- **DB**: PostgreSQL 16 · **Cache/Pub-Sub**: Redis 7
- **Containerization**: Docker + Docker Compose (Rancher Desktop 기반)

## 서비스 간 통신

```
Frontend (3000)
  ├── REST API  →  Backend (8000)
  ├── WebSocket →  Realtime (8001)
  └── REST API  →  AI Chatbot (8002)

Backend (8000)
  ├── DB        →  PostgreSQL (5432)
  └── Pub/Sub   →  Redis (6379)

Realtime (8001)
  ├── DB        →  PostgreSQL (5432)
  └── Pub/Sub   →  Redis (6379)

AI Chatbot (8002)
  └── DB        →  PostgreSQL (5432)
```

## 폴더 구조

```
.
├── backend/          # FastAPI REST API
│   └── app/
│       ├── models/project.py    # Project / SubProject / SubTask (+KEFICO 필드)
│       ├── schemas/project.py   # Pydantic 스키마 (enum: 검증상태/LEVEL/기타카테고리)
│       └── routers/projects.py  # CRUD + 유형별 템플릿 자동 생성
├── realtime/         # WebSocket 실시간 서버
├── frontend/         # Next.js 프론트엔드
│   └── app/
│       ├── lib/api.ts              # 도메인 타입 + 한국어 라벨 상수
│       ├── components/TeamModal.tsx # 유형별 조건부 폼 (검증 공통/1차·InReview/변경점/기타)
│       ├── projects/page.tsx       # 프로젝트 목록 + 소프로젝트 추가
│       ├── dashboard/page.tsx      # KPI + 오늘 할 일 + 최근 5건
│       ├── team-calendar/          # 팀 캘린더
│       └── personal-calendar/      # 개인 캘린더
├── ai-chatbot/       # AI 챗봇 서비스
├── database/         # DB 초기화 SQL
├── docs/
├── docker-compose.yml
├── docker-compose.dev.yml
└── .env.example
```

## 브랜치 전략

- `main`: 프로덕션 배포 브랜치
- `develop`: 통합 개발 브랜치
- `feature/<이름>/<기능>`: 기능 개발 브랜치 (예: `feature/backend/auth`, `feature/frontend/dashboard`)

---

## Windows 배포 가이드 (초보자용)

이 프로젝트는 **Docker Compose**로 모든 서비스를 한 번에 띄우므로, 컨테이너 런타임만 설치하면 됩니다. Python, Node.js 등을 별도로 설치할 필요가 없습니다.

### 1단계: 사전 준비 (Rancher Desktop 설치)

> **왜 Docker Desktop이 아닌가요?**
> Docker Desktop은 직원 250명 이상 또는 연 매출 $10M 이상인 회사에서 유료 구독이 필요합니다.
> **Rancher Desktop**은 SUSE에서 제공하는 완전 무료/오픈소스 대안으로, 상업적 사용에 제한이 없습니다.

#### 1-1. WSL 2 설치 (필수 선행)

PowerShell을 **관리자 권한**으로 열고 실행합니다:

```powershell
wsl --install
```

이미 설치되어 있다면 "이미 설치됨" 메시지가 나옵니다. 새로 설치했다면 **재부팅**이 필요합니다.

#### 1-2. Rancher Desktop 설치 & 초기 설정

1. https://rancherdesktop.io/ → "Download for Windows" → MSI 실행
2. 설치 후 실행 → **Container Engine: dockerd (moby)** 선택 (필수!)
   - containerd를 고르면 `docker compose`가 동작하지 않습니다
3. Kubernetes는 이 프로젝트에서 사용하지 않으므로 비활성화 가능
4. 설정 완료 후 1~3분 대기 (VM 생성)

#### 1-3. Docker 동작 확인

PowerShell을 **새로** 열고:

```powershell
docker --version
docker compose version
```

### 2단계: 환경 변수 설정

```powershell
Copy-Item .env.example .env
notepad .env
```

**반드시 변경할 항목:**

```env
POSTGRES_PASSWORD=MySecurePassword123!
DATABASE_URL=postgresql+psycopg2://cowork_user:MySecurePassword123!@db:5432/cowork_db
SECRET_KEY=my-super-secret-key-change-this-to-random-string

# AI 챗봇용 (선택)
OPENAI_API_KEY=sk-...
# 또는
ANTHROPIC_API_KEY=sk-ant-...
```

랜덤 SECRET_KEY 생성:
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### 3단계: 실행

#### (A) 프로덕션 모드 — 빌드된 이미지로 실행, 코드 수정 반영 없음

```powershell
docker compose up --build
```

처음 실행 시 5~15분 소요. 아래 로그가 나오면 정상:

```
cowork_db        | database system is ready to accept connections
cowork_redis     | Ready to accept connections
cowork_backend   | Uvicorn running on http://0.0.0.0:8000
cowork_realtime  | Uvicorn running on http://0.0.0.0:8001
cowork_ai_chatbot| Uvicorn running on http://0.0.0.0:8002
cowork_frontend  | Ready on http://0.0.0.0:3000
```

#### (B) 개발 모드 — **코드 수정 즉시 반영** ⭐ 추천

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

개발 모드에서 자동으로 적용되는 설정:
- Backend / Realtime / AI Chatbot: `uvicorn --reload` — Python 파일 저장 시 자동 재시작
- Frontend: `npm run dev` (Next.js dev 모드) — `.tsx` 저장 시 브라우저가 HMR로 즉시 갱신
- 호스트의 소스 폴더(`./backend`, `./frontend` 등)가 컨테이너로 bind-mount — IDE에서 편집한 파일이 컨테이너 안에서 그대로 보임

#### (C) 백그라운드 실행 (터미널 종료해도 유지)

```powershell
docker compose up --build -d
docker compose logs -f          # 로그 보기 (Ctrl+C로 로그만 빠져나옴)
```

### 4단계: 접속 & 확인

| 용도 | URL |
|------|-----|
| 웹 화면 (Frontend) | http://localhost:3000 |
| Backend Swagger UI | http://localhost:8000/docs |
| Realtime API 문서 | http://localhost:8001/docs |
| AI Chatbot API 문서 | http://localhost:8002/docs |

---

## 개발 워크플로우 — `docker compose up --build` 상태로 개발하기

목표: **컨테이너를 띄워둔 채 코드를 수정하면 즉시 반영**되는 흐름.

### 1. 최초 1회: 개발 모드로 기동

```powershell
# 프로젝트 폴더에서
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

> 두 compose 파일을 매번 타이핑하기 귀찮다면 PowerShell 프로필이나 별칭으로 등록해두세요:
> ```powershell
> function dcdev { docker compose -f docker-compose.yml -f docker-compose.dev.yml @args }
> # 이후 dcdev up --build / dcdev logs -f frontend 로 사용
> ```

### 2. 코드 수정하면 어떻게 반영되는가

| 변경 대상 | 즉시 반영 여부 | 추가 조치 |
|-----------|---------------|-----------|
| `frontend/app/**/*.tsx` | ✅ 브라우저가 HMR로 자동 갱신 | 없음 |
| `frontend/app/globals.css`, Tailwind 클래스 | ✅ 자동 갱신 | 없음 |
| `frontend/package.json` (의존성 추가) | ❌ | `docker compose -f … -f docker-compose.dev.yml build frontend` 후 재기동 |
| `backend/app/**/*.py` | ✅ uvicorn `--reload`가 감지해 재시작 (1~3초) | Swagger UI 새로고침 |
| `backend/requirements.txt` | ❌ | `docker compose build backend` → `up` |
| `backend/app/models/**.py` (DB 스키마 변경) | ⚠️ 재시작은 되지만 **기존 테이블은 변경되지 않음** | 아래 "DB 스키마 변경 시" 참조 |
| `docker-compose*.yml`, `Dockerfile` | ❌ | `up --build`로 전체 재기동 |
| `.env` | ❌ | `docker compose restart` |

### 3. 변경 내용 확인 체크리스트

프론트엔드를 고쳤을 때:
1. 브라우저에서 http://localhost:3000 을 새로고침 (대부분 불필요 — HMR)
2. 브라우저 콘솔에 빨간색 에러 있는지 확인
3. 타입 오류 의심 시 호스트에서:
   ```powershell
   cd frontend
   npx tsc --noEmit
   ```

백엔드를 고쳤을 때:
1. `docker compose logs -f backend` 로 `Uvicorn … Application startup complete.` 재등장 확인
2. http://localhost:8000/docs 에서 엔드포인트가 제대로 반영됐는지 확인
3. 실제 호출해보기 — Swagger UI의 "Try it out" 또는 프론트에서 기능 테스트

### 4. DB 스키마 변경 시 (모델 파일 수정)

현재 구현은 `Base.metadata.create_all()`로 **최초 1회만** 테이블을 만듭니다. 컬럼을 추가/삭제하면 기존 테이블이 그대로 남아 `column X does not exist` 에러가 납니다.

**개발 중 권장 절차:**

```powershell
# 1. 스택 정지 + DB 볼륨까지 삭제 (데이터 초기화)
docker compose down -v

# 2. 재기동 (테이블이 최신 모델 기준으로 새로 생성됨)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# 3. 브라우저에서 다시 회원가입 → 로그인 → 관리자로 테스트
```

> **주의**: `-v` 플래그는 PostgreSQL 데이터 볼륨을 완전히 지웁니다. 유지하고 싶은 데이터가 있으면 먼저 백업하세요.
>
> 프로덕션에서는 Alembic으로 마이그레이션 파일을 생성·적용하는 흐름으로 바꿔야 합니다. (이 레포는 설정만 되어있고 실제 마이그레이션은 아직 미사용 상태입니다.)

### 5. 자주 쓰는 명령어

```powershell
docker compose ps                               # 서비스 상태
docker compose logs -f backend                  # 백엔드 실시간 로그
docker compose logs -f frontend                 # 프론트 실시간 로그
docker compose logs -f --tail=100               # 전체 서비스, 최근 100줄부터
docker compose restart backend                  # 특정 서비스만 재시작
docker compose exec backend bash                # 컨테이너 안으로 진입
docker compose exec db psql -U cowork_user -d cowork_db    # DB 접속
docker compose down                             # 전체 정지 (데이터 유지)
docker compose down -v                          # 전체 정지 + DB 초기화
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build frontend  # 특정 서비스만 dev 빌드
```

### 6. 컨테이너 안에서 직접 디버깅

```powershell
# 백엔드 셸에서 python 대화형으로 DB 조회
docker compose exec backend python
>>> from app.db import SessionLocal
>>> from app.models.project import SubProject
>>> db = SessionLocal()
>>> db.query(SubProject).all()

# DB 직접 조회
docker compose exec db psql -U cowork_user -d cowork_db
cowork_db=# \dt
cowork_db=# SELECT id, name, status FROM subprojects LIMIT 10;
```

---

## 자주 발생하는 문제

### "docker: command not found" / "Cannot connect to the Docker daemon"
Rancher Desktop이 실행 중인지 시스템 트레이에서 확인. PowerShell을 새로 여세요.

### "port is already allocated"
```powershell
netstat -ano | findstr :8000
tasklist | findstr <PID>
```
프로세스를 종료하거나 `.env`에서 포트를 바꾸세요.

### 빌드 중 `invalid file request node_modules/.bin/acorn` (Windows npm 심볼릭 링크 이슈)
각 서비스 폴더의 `.dockerignore`에 `node_modules`를 제외하는 규칙이 있습니다. 그래도 재현된다면 호스트에서 `frontend/node_modules`를 지우고 다시 빌드하세요:
```powershell
Remove-Item -Recurse -Force frontend/node_modules
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### `column users.role does not exist` 또는 `column subprojects.controller_name does not exist`
DB에 이미 과거 스키마로 만든 테이블이 남아있기 때문입니다. 개발 중이면:
```powershell
docker compose down -v
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### HMR이 동작하지 않음 / 저장해도 반영 안 됨
- Windows 파일 시스템 → WSL2 이벤트 전달 문제일 가능성. `frontend/next.config.ts`에 `webpack → watchOptions: { poll: 1000 }` 추가를 시도해보세요.
- 혹은 `docker compose restart frontend` 로 강제 재시작.

### DB 연결 에러 (backend가 계속 재시작)
healthcheck가 DB 준비를 기다리므로 보통 1~2분 내 자동 연결됩니다. 그래도 안 되면 `docker compose down -v` 후 재기동.

---

## Quick Start (요약)

```powershell
# 1. WSL 2 설치 (관리자 PowerShell)
wsl --install   # 재부팅

# 2. Rancher Desktop 설치 (https://rancherdesktop.io/)
#    Container Engine: dockerd (moby) 선택

# 3. 프로젝트 폴더
cd "C:\경로\2026_project_management_and_cowork_tool"

# 4. 환경변수
Copy-Item .env.example .env
notepad .env      # POSTGRES_PASSWORD, SECRET_KEY 수정

# 5. 개발 모드로 실행 (코드 수정 즉시 반영)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# 6. 브라우저에서 http://localhost:3000 접속
#    회원가입 시 "관리자"로 가입하면 프로젝트 생성까지 바로 테스트 가능
```
