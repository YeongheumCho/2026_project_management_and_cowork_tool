'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useMemo, useState } from 'react';
import { API_BASE_URL } from '../lib/api';

type ApiError = {
  detail?: string | Array<{ msg: string }>;
};

function getErrorMessage(data: ApiError | null, defaultMessage: string) {
  if (!data) return defaultMessage;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map((item) => item.msg).join(', ');
  }
  return defaultMessage;
}

export default function SignupPage() {
  const router = useRouter();
  const [idnum, setIdnum] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const validationError = useMemo(() => {
    if (!/^\d{4,9}$/.test(idnum)) {
      return '사번은 4~9자리 숫자로 입력해주세요.';
    }
    if (name.trim().length < 2) return '이름은 2자 이상 입력해주세요.';
    if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
    if (password !== confirmPassword) {
      return '비밀번호 확인이 일치하지 않습니다.';
    }
    if (!termsAccepted) return '약관 동의가 필요합니다.';
    return '';
  }, [confirmPassword, idnum, name, password, termsAccepted]);

  async function handleSignup(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idnum, name: name.trim(), password, role }),
      });
      const data: ApiError = await response.json();

      if (!response.ok) {
        setMessage(getErrorMessage(data, '회원가입에 실패했습니다.'));
        return;
      }

      setMessage('회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.');
      window.setTimeout(() => router.push('/login'), 900);
    } catch (error) {
      setMessage(`회원가입 요청 중 오류가 발생했습니다: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F8F5] px-6 py-12 text-[#1A1A1A]">
      <div className="mx-auto max-w-lg rounded-[28px] border border-[#EAEAE4] bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-tiny font-bold uppercase tracking-[1px] text-[#888780]">
            WorkFlow AI
          </p>
          <h1 className="mt-2 text-3xl font-bold">회원가입</h1>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="사번">
              <input
                value={idnum}
                onChange={(event) => setIdnum(event.target.value)}
                className="input"
                placeholder="예: 2026001"
              />
            </Field>
            <Field label="이름">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input"
                placeholder="이름 입력"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="비밀번호">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input"
                placeholder="8자 이상"
              />
            </Field>
            <Field label="비밀번호 확인">
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="input"
                placeholder="비밀번호 재입력"
              />
            </Field>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <RoleButton
              selected={role === 'member'}
              onClick={() => setRole('member')}
              title="구성원"
              description="기본 사용자 권한"
            />
            <RoleButton
              selected={role === 'admin'}
              onClick={() => setRole('admin')}
              title="관리자"
              description="프로젝트/템플릿 관리"
            />
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-[#EAEAE4] bg-[#FAFAFA] px-4 py-3">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#534AB7]"
            />
            <span className="text-sm text-[#5F5E5A]">
              서비스 이용약관 및 개인정보 처리방침에 동의합니다.
            </span>
          </label>

          {message && (
            <p
              className={`rounded-xl px-4 py-3 text-sm ${
                message.includes('완료')
                  ? 'bg-[#EEEDFE] text-[#534AB7]'
                  : 'bg-[#FCEBEB] text-[#A32D2D]'
              }`}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#534AB7] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? '가입 처리 중...' : '회원가입'}
          </button>
        </form>

        <p className="mt-6 text-sm text-[#888780]">
          이미 계정이 있다면{' '}
          <Link href="/login" className="font-semibold text-[#534AB7] underline">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.8px] text-[#888780]">
        {label}
      </span>
      {children}
    </label>
  );
}

function RoleButton({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition ${
        selected
          ? 'border-[#534AB7] bg-[#EEEDFE]'
          : 'border-[#EAEAE4] bg-white hover:bg-[#FAFAFA]'
      }`}
    >
      <p className="text-sm font-bold text-[#1A1A1A]">{title}</p>
      <p className="mt-1 text-xs text-[#888780]">{description}</p>
    </button>
  );
}
