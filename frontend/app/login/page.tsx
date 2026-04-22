'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { API_BASE_URL, apiFetch, type Me } from '../lib/api';

type ApiError = {
  detail?: string | Array<{ msg: string }>;
  access_token?: string;
};

function getErrorMessage(data: ApiError | null, defaultMessage: string) {
  if (!data) return defaultMessage;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map((item) => item.msg).join(', ');
  }
  return defaultMessage;
}

export default function LoginPage() {
  const router = useRouter();
  const [idnum, setIdnum] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setMessage('');

    if (!idnum.trim() || !password) {
      setMessage('사번과 비밀번호를 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', idnum);
      formData.append('password', password);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });
      const data: ApiError = await response.json();

      if (!response.ok) {
        setMessage(getErrorMessage(data, '로그인에 실패했습니다.'));
        return;
      }
      if (!data.access_token) {
        setMessage('로그인 응답에 access token이 없습니다.');
        return;
      }

      localStorage.setItem('access_token', data.access_token);

      try {
        await apiFetch<Me>('/auth/me');
      } catch {
        localStorage.removeItem('access_token');
        setMessage('프로필 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      router.push('/dashboard');
    } catch (error) {
      setMessage(`로그인 요청 중 오류가 발생했습니다: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F8F5] px-6 py-12 text-[#1A1A1A]">
      <div className="mx-auto max-w-md rounded-[28px] border border-[#EAEAE4] bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[1px] text-[#888780]">
            WorkFlow AI
          </p>
          <h1 className="mt-2 text-3xl font-bold">로그인</h1>
          <p className="mt-2 text-sm text-[#888780]">
            사번과 비밀번호로 로그인한 뒤 대시보드로 이동합니다.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.8px] text-[#888780]">
              사번
            </span>
            <input
              value={idnum}
              onChange={(event) => setIdnum(event.target.value)}
              className="input"
              placeholder="사번 입력"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.8px] text-[#888780]">
              비밀번호
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input"
              placeholder="비밀번호 입력"
            />
          </label>

          <div className="flex items-center justify-between text-xs text-[#888780]">
            <span>인증 실패 시 관리자에게 비밀번호 초기화를 요청하세요.</span>
            <button
              type="button"
              onClick={() =>
                setMessage('비밀번호 분실 시 관리자에게 초기화를 요청해주세요.')
              }
              className="font-semibold text-[#534AB7]"
            >
              비밀번호 분실
            </button>
          </div>

          {message && (
            <p
              className={`rounded-xl px-4 py-3 text-sm ${
                message.includes('요청') || message.includes('실패') || message.includes('못')
                  ? 'bg-[#FCEBEB] text-[#A32D2D]'
                  : 'bg-[#EEEDFE] text-[#534AB7]'
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
            {loading ? '로그인 처리 중...' : '로그인'}
          </button>
        </form>

        <p className="mt-6 text-sm text-[#888780]">
          아직 계정이 없다면{' '}
          <Link href="/signup" className="font-semibold text-[#534AB7] underline">
            회원가입
          </Link>
        </p>
      </div>
    </main>
  );
}
