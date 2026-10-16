# DB 백업과 복구

폐쇄망 PC 한 대의 Docker 볼륨(`postgres_data`)에만 데이터가 있습니다.
디스크가 고장 나거나 볼륨을 실수로 지우면 되살릴 방법이 없으므로, 매일 파일로 떠 둡니다.

## 한 번만 하면 되는 설정

저장소 폴더에서 PowerShell 을 열고 실행합니다.

```powershell
.\scripts\backup\register-backup-task.ps1
```

- 매일 12:30 에 백업합니다. 시각을 바꾸려면 `-At 18:30` 처럼 줍니다.
- 14일이 지난 백업은 지웁니다. 바꾸려면 `-KeepDays 30` 처럼 줍니다.
- PC 가 꺼져 있어 시각을 놓치면, 다음에 켜졌을 때 바로 한 번 돕니다.
- 작업 스케줄러에 **SureLog DB 백업** 이라는 이름으로 보입니다.

## 지금 바로 백업하기

```powershell
.\scripts\backup\backup-db.ps1
```

결과는 `backups\surelog_YYYYMMDD_HHmm.dump` 이고, 기록은 `backups\backup.log` 에 남습니다.
백업 파일은 만든 직후 읽어 보고, 읽히지 않으면 지우고 실패로 기록합니다.

> 같은 PC 에 두면 디스크 고장에는 소용이 없습니다. 가끔 `backups` 폴더를 다른 저장 장치로 복사해 두세요.

## 되살리기

현재 DB 를 백업 시점으로 **덮어씁니다.** 백업 이후의 입력은 사라집니다.

1. 화면과 서버를 멈춰 그 사이 들어오는 입력을 막습니다.

   ```powershell
   docker compose stop frontend backend ai-chatbot
   ```

2. 되살릴 파일을 DB 컨테이너에 넣고 복구합니다. 파일 이름은 실제 이름으로 바꿉니다.

   ```powershell
   docker cp .\backups\surelog_20261016_1230.dump cowork_db:/tmp/restore.dump
   docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner /tmp/restore.dump && rm /tmp/restore.dump'
   ```

3. 다시 올립니다.

   ```powershell
   docker compose up -d
   ```

### 덮어쓰기 전에 먼저 확인하고 싶을 때

빈 DB 에 복구해 내용을 본 뒤 지웁니다. 운영 DB 는 건드리지 않습니다.

```powershell
docker cp .\backups\surelog_20261016_1230.dump cowork_db:/tmp/restore.dump
docker compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" restore_test && pg_restore -U "$POSTGRES_USER" -d restore_test --no-owner /tmp/restore.dump'
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d restore_test -c "select count(*) from users"'
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" restore_test && rm /tmp/restore.dump'
```
