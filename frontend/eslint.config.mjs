import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

// 디자인 시스템 가드:
//   - className 안의 임의 hex (`bg-[#xxxxxx]` 등) 금지 — 정의된 토큰 사용 강제
//   - raw `slate-*` 클래스 금지 — 시맨틱 토큰 사용 강제
// 마이그레이션 기간 중 warn 으로 운영, 잔여 위반 0건에 도달하면 error 로 승격.
const designSystemRules = {
  "no-restricted-syntax": [
    "warn",
    {
      // 임의 hex: className 안에서 -[#XXXXXX] 패턴 일반 감지
      selector: "Literal[value=/-\\[#[0-9A-Fa-f]/]",
      message:
        "디자인 토큰을 사용하세요. 임의 hex(`bg-[#XXXXXX]` 등)는 금지 — globals.css 의 토큰을 직접 참조하거나 Tailwind 시맨틱 클래스(bg-brand, text-text 등)를 사용하세요.",
    },
    {
      selector: "TemplateElement[value.raw=/-\\[#[0-9A-Fa-f]/]",
      message:
        "디자인 토큰을 사용하세요. 임의 hex(`bg-[#XXXXXX]` 등)는 금지 — globals.css 의 토큰을 직접 참조하거나 Tailwind 시맨틱 클래스(bg-brand, text-text 등)를 사용하세요.",
    },
    {
      // slate-*: bg/text/border/ring 등 + slate-NNN 결합
      selector: "Literal[value=/-slate-[0-9]/]",
      message:
        "slate-* 대신 시맨틱 토큰을 사용하세요: text-text / text-text-subtle / text-text-muted / text-text-faint / border-border / bg-surface-muted 등.",
    },
    {
      selector: "TemplateElement[value.raw=/-slate-[0-9]/]",
      message:
        "slate-* 대신 시맨틱 토큰을 사용하세요: text-text / text-text-subtle / text-text-muted / text-text-faint / border-border / bg-surface-muted 등.",
    },
  ],
};

export default defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["app/**/*.{ts,tsx,js,jsx}"],
    rules: designSystemRules,
  },
]);
