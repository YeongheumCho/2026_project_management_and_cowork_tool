# 문서 목록

## 설치와 배포

| 문서 | 내용 |
|---|---|
| [Windows 배포 가이드](../DEPLOY_GUIDE_WINDOWS.md) | Rancher Desktop 설치부터 실행까지. 개발 워크플로우와 문제 해결도 여기에 있다 |
| [사내 도메인 배포](./internal-domain-deployment.md) | 컴퓨터 이름으로 접속하게 만드는 리버스 프록시 구성 |

## 운영

| 문서 | 내용 |
|---|---|
| [인원 동기화](./org-sync-guide.md) | 그룹웨어 조직도로 사용자 목록을 맞추는 방법. 평상시 인원 관리는 이 문서를 본다 |
| [데이터베이스 초기화](./setup/database-setup.md) | DB를 비우고 조직도를 처음 넣을 때. 최초 구축용 |

## 설계

| 문서 | 내용 |
|---|---|
| [시스템 아키텍처](./architecture.md) | 서비스 구성도와 데이터 흐름 |
| [디자인 시스템 감사](./design-system/AUDIT.md) | 2026-06 시점 감사 기록. 지적사항은 모두 해결됨 |

## 개발 규칙

에이전트와 기여자용 규칙은 저장소 루트에 있다.

- [CLAUDE.md](../CLAUDE.md) — Claude Code용 프로젝트 지침. 서비스 경계, 검증 범위, 편집 지침
- [AGENTS.md](../AGENTS.md) — Codex용 지침

작업 스킬은 `.claude/skills/`와 `.agents/skills/` 두 곳에 **같은 내용으로** 들어 있다.
도구마다 읽는 경로가 달라서 그렇다. 한쪽을 고치면 다른 쪽도 같이 고쳐야 한다.
