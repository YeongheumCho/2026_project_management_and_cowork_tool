# 데이터베이스 초기화 & E-모빌리티센터 조직도 임포트 가이드

이 문서는 **다른 개발자가 우리 저장소를 클론한 직후** 동일한 DB 상태(104명 조직도 등록 완료)를 재현하기 위한 절차를 설명합니다.

> **대상 독자**: 백엔드/프론트엔드/DB 역할 구분 없이 로컬에서 풀스택을 띄우는 개발자.
> **전제 조건**: Rancher Desktop (또는 Docker Desktop) 설치 완료, 저장소 클론 완료.

---

## 1. 무엇이 바뀌었나

- 기존 더미 시드 (`A1001`, `M2001~M2004`) 는 제거되었고, 더 이상 사용하지 않습니다.
- **104명 실사용자**가 `backend/scripts/data/사번포함조직도.csv` 를 기반으로 일괄 등록됩니다.
- `User` 모델에 `team / position / email / phone` 컬럼이 추가되었습니다.
  따라서 기존 개발 DB 볼륨을 그대로 쓰면 `column users.team does not exist` 오류가 납니다 → **DB 볼륨 초기화 필수**.

## 2. 임포트 규칙 요약

| 조건 | 결과 role |
|------|----------|
| CSV 의 `rel == MASTER` (팀장/실장/센터장) | `admin` |
| 이름이 `조영흠, 박상은, 신현지, 김한결` 중 하나 (서비스 개발자) | `admin` |
| 나머지 | `member` |

- **초기 비밀번호**: 전원 `00000000` (bcrypt 해시로 저장)
- **로그인 ID**: 사번 (예: `20220101`, `90502001` 등)
- 동일 사번 재실행 시 메타데이터(`team/position/email/phone/role/name`)만 덮어쓰고 **비밀번호는 유지** — 이미 본인 비밀번호로 바꾼 사용자를 보호하기 위함.

## 3. 초기화 & 임포트 절차

### 3-1. `.env` 준비

```powershell
Copy-Item .env.example .env
notepad .env
```

`POSTGRES_PASSWORD` / `DATABASE_URL` / `SECRET_KEY` 를 반드시 바꿔주세요. 자세한 값은 루트의 [README.md](../../README.md) `Windows 배포 가이드` 참조.

### 3-2. 기존 DB 볼륨 초기화

> **주의**: 로컬에 남아있던 기존 데이터(프로젝트, 소프로젝트, 작업 로그 등)가 전부 삭제됩니다. 필요한 데이터는 미리 백업하세요.

```powershell
docker compose down -v
```

`-v` 플래그가 핵심입니다. 이게 `postgres_data` named volume 을 통째로 삭제합니다. 이 단계를 건너뛰면 새 컬럼이 기존 테이블에 추가되지 않아 서버 부팅 시 오류가 납니다.

### 3-3. 백엔드 + DB 기동 (테이블 자동 생성)

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db redis backend
```

백엔드의 `app/main.py` 는 기동 시 `Base.metadata.create_all(bind=engine)` 를 호출해 최신 모델 정의로 테이블을 새로 만듭니다. 로그에 아래가 보이면 준비 완료:

```
cowork_db        | database system is ready to accept connections
cowork_backend   | Uvicorn running on http://0.0.0.0:8000
cowork_backend   | Application startup complete.
```

### 3-4. 조직도 CSV 임포트

```powershell
docker compose exec backend python scripts/import_org_chart.py
```

정상 출력 예시:

```
[parse] 사번포함조직도.csv — 104명 / 팀 14개 / admin 18명
[purge] 더미 사용자 0명 / 샘플 프로젝트 0건 삭제
[upsert] 신규 104명 / 갱신 0명
[commit] 조직도 임포트 완료. 초기 비밀번호: 00000000
```

> **CSV 경로를 커스텀하고 싶다면**
> ```powershell
> docker compose exec backend python scripts/import_org_chart.py /path/inside/container.csv
> ```
> 기본값은 `backend/scripts/data/사번포함조직도.csv` (컨테이너 안에서 `/app/scripts/data/사번포함조직도.csv`) 입니다.

### 3-5. 임포트 결과 확인

```powershell
docker compose exec db psql -U cowork_user -d cowork_db -c "SELECT role, COUNT(*) FROM users GROUP BY role ORDER BY role;"
```

기대 결과:

```
 role  | count
-------+-------
 admin |    18
 member|    86
```

팀별 인원 확인:

```powershell
docker compose exec db psql -U cowork_user -d cowork_db -c "SELECT team, COUNT(*) FROM users GROUP BY team ORDER BY team;"
```

### 3-6. 프론트엔드까지 기동

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d frontend realtime ai-chatbot
```

브라우저에서 http://localhost:3000 → 본인 사번 / `00000000` 으로 로그인.

## 4. 자주 하는 실수

### "column users.team does not exist"
3-2 단계(`docker compose down -v`)를 건너뛴 경우. DB 볼륨을 완전히 지워야 테이블이 최신 스키마로 재생성됩니다.

### "CSV 를 찾을 수 없음"
`backend/scripts/data/사번포함조직도.csv` 가 저장소에 포함되어 있는지 확인:

```powershell
ls backend\scripts\data\
```

파일이 없다면 소스 브랜치에서 `git pull` 후 재시도.

### 같은 사람이 두 번 등록됨
사번(idnum) 이 유니크 키 역할을 하므로 같은 사번은 항상 upsert 됩니다. 이름이 같아도 사번이 다르면 다른 사람으로 취급합니다.

### 비밀번호를 재설정하고 싶을 때
스크립트는 기존 사용자 비밀번호를 건드리지 않습니다. 특정 사용자의 비밀번호를 초기화하려면:

```powershell
docker compose exec backend python - <<'PY'
from app.core.security import hash_password
from app.db import SessionLocal
from sqlalchemy import select
from app.models.user import User

idnum = "20220101"  # 초기화할 사번
with SessionLocal() as db:
    user = db.scalar(select(User).where(User.idnum == idnum))
    user.password_hash = hash_password("00000000")
    db.commit()
    print(f"{user.name} ({user.idnum}) 비밀번호 초기화 완료")
PY
```

## 5. 신규 직원 추가 / 조직 개편 반영

1. `backend/scripts/data/사번포함조직도.csv` 를 최신 조직도로 교체
2. 커밋 & 푸시
3. 각 개발자가 로컬에서 재실행:

   ```powershell
   docker compose exec backend python scripts/import_org_chart.py
   ```

스크립트는 멱등성을 가지므로 몇 번을 돌려도 안전합니다. 새 사번은 추가되고, 기존 사번은 메타만 갱신됩니다.

## 6. 스크립트 내부 동작 (참고)

- `backend/scripts/import_org_chart.py` 는 다음 순서로 동작:
  1. `[Sample]%` 로 시작하는 프로젝트 삭제 (프로젝트 → 소프로젝트 → 세부태스크 → 진척 로그 cascade)
  2. 기존 더미 사번 (`A1001`, `M2001~M2004`) 사용자 삭제 (사용자 → work_logs / user_workflow_state cascade)
  3. CSV 104행을 upsert — 신규는 INSERT, 기존 사번은 UPDATE
  4. 커밋

- 역할 결정 로직은 `determine_role()`, 팀명 정규화는 `normalize_team()` 참고.

---

## 참고 파일

- 스크립트: [`backend/scripts/import_org_chart.py`](../../backend/scripts/import_org_chart.py)
- 원본 CSV: [`backend/scripts/data/사번포함조직도.csv`](../../backend/scripts/data/사번포함조직도.csv)
- User 모델: [`backend/app/models/user.py`](../../backend/app/models/user.py)
- Docker Compose 구성: [`docker-compose.yml`](../../docker-compose.yml)
