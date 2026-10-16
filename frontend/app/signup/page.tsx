import Link from 'next/link';

/**
 * 회원가입은 닫았다 (2026-10-16).
 * 계정은 관리자의 인원 동기화로 만들어진다. 예전에는 여기서 누구나 관리자 계정을
 * 만들 수 있었고, 남의 사번을 먼저 가입해 둘 수도 있었다.
 * 즐겨찾기 등으로 이 주소에 들어온 사람에게 안내만 보여 준다.
 */
export default function SignupClosedPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-text">
      <div className="mx-auto max-w-md rounded-[28px] border border-border bg-surface p-8 shadow-sm">
        <p className="text-tiny font-bold uppercase tracking-[1px] text-text-subtle">SureLog AI</p>
        <h1 className="mt-2 text-3xl font-bold">회원가입 안내</h1>
        <p className="mt-4 text-sm leading-6 text-text-subtle">
          회원가입은 따로 하지 않습니다. 계정은 관리자가 인원 동기화로 만들어 드립니다.
          계정이 없거나 로그인이 되지 않으면 관리자에게 문의해 주세요.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-hover"
        >
          로그인 화면으로
        </Link>
      </div>
    </main>
  );
}
