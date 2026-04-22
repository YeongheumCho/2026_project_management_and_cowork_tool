# 디자인 시스템 감사 리포트

> 생성일: 2026-04-22 · 대상: `frontend/app/` (Next.js 15 + React 19 + Tailwind CSS v4) · 도구: `/design-system audit`

## Summary

| 항목 | 값 |
|------|----|
| 검토 컴포넌트 | **5개** (`AppShell`, `ChatBot`, `MonthCalendar`, `PersonalModal`, `TeamModal`) |
| 페이지 | 10개 (`dashboard`, `team-calendar`, `personal-calendar`, `projects`, `projects/[id]`, `tasks`, `team`, `admin`, `login`, `signup`) |
| 발견된 이슈 | **17건** (Critical 2 · High 5 · Medium 6 · Low 4) |
| 디자인 시스템 점수 | **38 / 100** |

> 점수가 낮은 핵심 원인: ① 디자인 토큰 거의 미정의(@theme에 색상 토큰 0개) ② 깨진 유틸리티 클래스(`input` 32회 사용·미정의) ③ `STATUS_LABEL`/`STATUS_BADGE` 4개 파일에 중복 정의 ④ backend의 10단계 검증 상태 enum과 프론트엔드 매핑 부재.

---

## 🔴 Critical Findings

### C-1. `className="input"` 유틸리티가 정의되지 않음 — TeamModal 전체 폼이 스타일 미적용 위험

- **위치**: `frontend/app/components/TeamModal.tsx` 32회 (라인 381~759), `globals.css`에 `.input` 정의 없음
- **증거**: `grep -rn '\.input' frontend/app/**/*.css` → 0건. `globals.css`는 `@import "tailwindcss"` + `@theme` 토큰 4개 + body 스타일만 포함
- **영향**: 사용자 모달의 모든 input/select/textarea가 브라우저 기본 스타일로 렌더링됨. 시각적 일관성 완전 붕괴
- **권장 조치**: `globals.css`에 `@layer components` 또는 Tailwind v4 `@utility input` 으로 정의:
  ```css
  @utility input {
    @apply w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm
           focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20;
  }
  ```

### C-2. 검증 상태 (10단계) 색상/라벨 매핑이 프론트엔드에 부재

- **위치**: `backend/app/schemas/project.py:20` 의 `VerifyState` Literal — 10개 값 (`not_started`, `in_progress`, `all_pass`, `fail_issue`, `pass_issue`, `review_done`, `inreview_waiting`, `inreview_in_progress`, `inreview_done`, `uploaded`)
- **증거**: 프론트엔드에서 `first_verify_status`, `inreview_status` 필드는 backend가 보내주지만 **표시용 라벨/색상 사전이 어디에도 없음**. 현재 `STATUS_*` 상수는 SubProject 진행상태(planned/in_progress/completed) 3개뿐
- **영향**: 검증 단계가 화면에 raw enum 문자열(`fail_issue`)로 그대로 노출되거나 색상 구분 없이 표시됨
- **권장 조치**: `frontend/app/lib/verifyStatus.ts` 파일 신설 — `VERIFY_STATE_LABEL` (한글) + `VERIFY_STATE_BADGE` (시맨틱 토큰 클래스) 단일 정의

---

## 🟠 High Findings

### H-1. `STATUS_LABEL` / `STATUS_BADGE` 가 4개 파일에 중복 정의

| 파일 | 정의된 상수 |
|------|-----------|
| `app/components/MonthCalendar.tsx:26` | `STATUS_BG` |
| `app/dashboard/page.tsx:9, 15` | `STATUS_LABEL`, `STATUS_BADGE` |
| `app/projects/page.tsx:18, 24` | `STATUS_LABEL`, `STATUS_BADGE` (같음) |
| `app/team-calendar/page.tsx:10, 19` | `STATUS_LABEL`, `STATUS_DOT` |

- **권장**: `frontend/app/lib/subprojectStatus.ts` 단일 출처로 통합 — 변형(badge/dot/bg)을 하나의 객체로 export

### H-2. `API_BASE_URL = 'http://127.0.0.1:8000'` 4곳에 하드코딩

- `lib/api.ts:4`, `admin/page.tsx:7`, `login/page.tsx:7`, `signup/page.tsx:7`
- **권장**: `lib/api.ts` 의 export만 사용. 환경 변수 `NEXT_PUBLIC_API_BASE_URL` 추가 검토

### H-3. 디자인 토큰이 사실상 없음 — `@theme` 에 4줄만 정의됨

```css
/* 현재 globals.css */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```
- **누락**: 시맨틱 색상(success/warning/error/info), 상태 색상, 간격 스케일, 둥글기, 그림자 토큰
- **영향**: 모든 컴포넌트가 raw Tailwind 팔레트(`bg-blue-600`, `text-emerald-700`)를 직접 호출 → 브랜드 변경 시 41개 파일 수정 필요
- **권장 토큰 (예시)**:
  ```css
  @theme inline {
    --color-brand: #2563eb;        /* bg-blue-600 17곳 사용 → token화 */
    --color-surface: #ffffff;
    --color-surface-muted: #f1f5f9; /* slate-100 14곳 */
    --color-border: #e2e8f0;        /* slate-200 41곳 */
    --color-text-muted: #64748b;    /* slate-500 29곳 */
    --color-status-planned: #cbd5e1;
    --color-status-progress: #3b82f6;
    --color-status-done: #10b981;
  }
  ```

### H-4. `border-slate-200` 41회, `text-slate-500` 29회 — 사실상의 토큰을 raw 클래스로 반복

| Raw 클래스 | 사용 횟수 | 시맨틱 의미 (추정) |
|------------|----------|-------------------|
| `border-slate-200` | 41 | default border |
| `text-slate-500` | 29 | secondary text |
| `text-slate-400` | 26 | tertiary text |
| `bg-slate-50` | 17 | subtle surface |
| `bg-slate-100` | 14 | muted surface |
| `bg-blue-600` | 12 | primary brand |
| `bg-blue-700` | 6 | primary hover |

→ 각 라인별로 시맨틱 토큰으로 치환 가능. 통째로 일괄 변환 시 가독성·테마 전환 둘 다 향상

### H-5. 모달 패턴 중복 — `PersonalModal` / `TeamModal` 둘 다 동일한 backdrop·container 작성

```tsx
// 두 파일 모두 동일
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
  <div className="... rounded-2xl bg-white p-6 shadow-xl">...</div>
</div>
```
- **권장**: `app/components/Modal.tsx` 추출 — `size: 'sm' | 'md' | 'lg' | 'xl'` 변형, ESC/backdrop 닫기 옵션, 포커스 트랩 포함

---

## 🟡 Medium Findings

### M-1. 둥글기(radius) 4종 혼용 — `rounded-lg` 32회, `rounded-2xl` 27회, `rounded-xl` 24회, `rounded-full` 20회

같은 페이지 안에서 같은 깊이의 컨테이너가 `rounded-lg` 와 `rounded-xl` 을 섞어 씀.
- **권장**: 토큰 3개로 정리 — `--radius-sm` (8px, 칩), `--radius-md` (12px, 버튼/입력), `--radius-lg` (16px, 카드/모달)

### M-2. 임의 픽셀 값 31건 — 가장 흔한 패턴은 `text-[10px]`, `text-[11px]`

```
ChatBot.tsx:242    text-[10px]
MonthCalendar.tsx:104  text-[11px]
MonthCalendar.tsx:111  text-[10px]
TeamModal.tsx:897   text-[11px]
dashboard/page.tsx:157  text-[11px]   // STATUS_BADGE 안
... (총 31건)
```
- 한국어 가독성 측면에서 11px 이하 본문은 위험. **WCAG 1.4.4** (텍스트 200% 확대) 충돌 가능
- **권장**: `text-xs`(12px) 또는 새 토큰 `--text-micro: 0.6875rem` 도입

### M-3. 공통 폼 필드 컴포넌트 부재 — `Field`/`Label`/`HelperText` 없음

`TeamModal.tsx:494` 에 `<Field label="검증 LEVEL">` 같은 컴포넌트 호출이 보이는데 `Field` 정의 위치가 같은 파일 안에 가려져 있음(외부 export 없음).
- **권장**: `app/components/form/Field.tsx`, `Label.tsx`, `HelperText.tsx` 분리 후 모달/페이지 모두에서 재사용

### M-4. 버튼 패턴 6종 이상 변형 — `Button` 컴포넌트 없음

가장 자주 등장하는 변형:
```
4×  block rounded-xl px-4 py-3 text-sm hover:bg-blue-50          (사이드바 nav)
2×  rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-100  (secondary)
2×  rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50   (secondary 2)  ← 같은 의도, 둥글기/색상 다름
2×  rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white          (primary)
2×  rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700  (primary sm)
```
- **권장**: `app/components/Button.tsx` — `variant: 'primary' | 'secondary' | 'ghost' | 'danger'`, `size: 'sm' | 'md'`

### M-5. inline `style={{ width: '${progress}%' }}` 5곳

`dashboard`, `personal-calendar`, `projects`, `team-calendar`, `PersonalModal` 의 진행률 바가 동일한 패턴인데 각자 작성됨.
- **권장**: `app/components/ProgressBar.tsx` — `value: number`, `tone: 'planned' | 'progress' | 'done'`

### M-6. ChatBot 안 typing indicator dot 3개가 inline `style={{ animationDelay }}`

`ChatBot.tsx:208~210` 의 3개 점은 Tailwind 애니메이션 딜레이로 토큰화 가능.
- **권장**: `globals.css` 에 `--animate-bounce-stagger-{1,2,3}` 추가 또는 별도 `<TypingIndicator />` 컴포넌트로 추출

---

## 🟢 Low Findings

### L-1. `ChatBot.tsx:159` — `h-[520px] w-[380px]` 고정 치수
모바일 / 작은 뷰포트에서 잘릴 수 있음. `max-h-[80vh]` 형태로 변경 권장.

### L-2. 다크 모드 토큰만 정의되고 실제 사용 안 됨
`@media (prefers-color-scheme: dark)` 가 globals.css 에 있으나, `bg-white`, `text-slate-900` 같은 라이트 전용 클래스가 41곳 이상 → 다크 모드 부분 적용 상태. 다크 미지원 명시 또는 전체 적용 결정 필요.

### L-3. 이미지에 `alt` 속성 사용 0건
`<img>` 자체가 거의 없는 것으로 보이지만 (확인됨: 0건), 향후 사용자 아바타·차트 이미지 도입 시 alt 누락 위험. 컴포넌트 단계에서 강제할 것.

### L-4. focus 스타일이 디자인 시스템 차원에서 미정의
`focus:` 사용 1회만 검출 → 키보드 네비게이션 시 포커스 가시성 거의 없음. 토큰 `--ring-focus: 0 0 0 3px rgb(59 130 246 / 0.3)` 정의 후 `Button`/`input` 에 일괄 적용.

---

## Token Coverage

| 카테고리 | `@theme` 정의 | Raw 클래스 사용 발견 | 토큰화 권장 |
|----------|---------------|---------------------|-----------|
| Colors — brand | ❌ 없음 | `bg-blue-600` 12, `bg-blue-700` 6 | 🔴 즉시 |
| Colors — neutral | ❌ 없음 | `slate-{50,100,200,400,500,600,900}` 누적 100+회 | 🔴 즉시 |
| Colors — status | ❌ 없음 | `STATUS_BADGE` 4개 파일에 분산 정의 | 🔴 즉시 |
| Colors — semantic (success/error/warning) | ❌ 없음 | `bg-emerald-100/text-emerald-700` 등 | 🟠 권장 |
| Typography | ✅ 폰트만 | text-xs ~ text-3xl 7종 | 🟡 부분 |
| Spacing | ❌ Tailwind 기본만 | py-2 32회, px-4 26회 | 🟢 OK |
| Border radius | ❌ 없음 | `lg/xl/2xl/full/md` 5종 혼용 | 🟠 권장 |
| Shadows | ❌ 없음 | `shadow-sm` 11, `shadow-xl` 3 | 🟢 OK |
| Motion | ❌ 없음 | `animate-bounce` + 3개 inline delay | 🟡 부분 |

---

## Component Completeness

| 컴포넌트 | 변형 | 상태 (hover/focus/disabled/loading) | 문서 | 점수 |
|---------|------|-----------------------------------|------|------|
| `AppShell` | 1 (관리자/일반 직원 분기 라벨만) | hover만 | ❌ | 5/10 |
| `MonthCalendar` | 1 | — | ❌ | 4/10 |
| `PersonalModal` | 1 | — | ❌ | 4/10 |
| `TeamModal` | 폼 모드 다수 (4종 검증 유형 분기) | — | ❌ | 5/10 |
| `ChatBot` | 1 | typing 상태 있음 | ❌ | 6/10 |
| `Button` | **존재하지 않음** | — | ❌ | 0/10 |
| `Input/Field` | **부분 존재** (`.input` 미정의) | focus 거의 없음 | ❌ | 1/10 |
| `Modal` | **존재하지 않음** (Personal/TeamModal에 중복 작성) | — | ❌ | 0/10 |
| `Badge/Chip` | **존재하지 않음** (`STATUS_BADGE` 클래스만 있음) | — | ❌ | 0/10 |
| `ProgressBar` | **존재하지 않음** (5곳에 inline style) | — | ❌ | 0/10 |

---

## Naming Consistency

| 이슈 | 파일 | 권장 표준 |
|------|------|----------|
| `STATUS_BG` (MonthCalendar) vs `STATUS_BADGE` (dashboard, projects) vs `STATUS_DOT` (team-calendar) | 4개 파일 | 단일 객체 `subprojectStatus.{label, badge, dot, bar}` |
| 상수 case: `STATUS_LABEL` (UPPER_SNAKE) vs `getMonthMatrix` (camelCase) | 전반 | UI 매핑 객체는 `subprojectStatus` (camelCase) 로 |
| 파일명: `ChatBot.tsx` (PascalCase) vs `useMe.ts` (camelCase) | OK | 컴포넌트 PascalCase, 훅 camelCase 유지 — 일관됨 |
| 'Modal' 두 종류만 존재하는데 부모 컴포넌트(`Modal.tsx`) 없음 | components/ | 베이스 추출 후 `PersonalModal`/`TeamModal` 은 wrapper로 |

---

## Priority Actions (우선순위)

1. **🔴 [C-1] `.input` 유틸리티를 `globals.css` 에 정의** — TeamModal 전체 폼 스타일 복원, 30분 작업
2. **🔴 [C-2] `lib/verifyStatus.ts` 신설** — backend 10단계 enum 한글 라벨/시맨틱 색상 매핑, 1시간
3. **🟠 [H-1] `lib/subprojectStatus.ts` 통합** — 4개 파일 중복 제거, 30분
4. **🟠 [H-2] `API_BASE_URL` 단일화 + env 변수화** — 보안·환경 분리, 15분
5. **🟠 [H-3] `@theme` 에 시맨틱 토큰 8~12개 추가** — 향후 모든 작업의 기반, 1~2시간
6. **🟠 [H-5] `Modal.tsx` 베이스 컴포넌트 추출** — PersonalModal·TeamModal 리팩터, 1시간
7. **🟡 [M-3, M-4, M-5] `Field`, `Button`, `ProgressBar` 컴포넌트 신설** — 페이지 전반 정리, 반나절
8. **🟢 [L-4] focus 토큰 + 키보드 가시성** — 접근성 기본선, 30분

---

## GitHub Issue 초안 (제안)

이 감사 결과를 그대로 옮길 수 있는 이슈 초안:

| 제목 | 라벨 | 담당 |
|------|------|------|
| `[design-system] .input 유틸리티 정의 누락 — TeamModal 폼 스타일 깨짐` | `bug`, `frontend`, `design-system` | 개발자 3 |
| `[design-system] backend 10단계 검증 상태 → 프론트엔드 라벨/색상 매핑 추가` | `feature`, `frontend`, `design-system` | 개발자 3 |
| `[design-system] STATUS_LABEL/BADGE 4개 파일 중복 → lib/subprojectStatus.ts 통합` | `refactor`, `frontend`, `design-system` | 개발자 3 |
| `[design-system] @theme 시맨틱 토큰 도입 (brand/status/surface/text)` | `enhancement`, `frontend`, `design-system` | 개발자 3 |
| `[design-system] Modal/Button/Field/ProgressBar 베이스 컴포넌트 추출` | `refactor`, `frontend`, `design-system` | 개발자 3 |
| `[a11y] 포커스 가시성 토큰 도입 — focus:ring 미적용 41곳` | `a11y`, `frontend` | 개발자 3 |

---

## 다음 단계

- **컴포넌트 문서화**: `/design-system document Modal` (혹은 `Button`, `ProgressBar`)
- **새 패턴 설계**: `/design-system extend StatusBadge`
- **완료 후 회고**: 토큰 도입 후 `/design-system audit` 재실행하여 점수 변화 추적
