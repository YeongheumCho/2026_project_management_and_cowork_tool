'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
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

export default function LoginPage() {
  const router = useRouter();

  const [idnum, setIdnum] = useState('');
  const [password, setPassword] = useState('');

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', idnum);
      formData.append('password', password);

      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const data: ApiError & { access_token?: string } = await res.json();

      if (!res.ok) {
        setMessage(getErrorMessage(data, '로그인에 실패했습니다.'));
        return;
      }

      if (!data.access_token) {
        setMessage('로그인 응답에 access token이 없습니다.');
        return;
      }

      localStorage.setItem('access_token', data.access_token);
      setMessage('로그인 성공!');
      router.push('/dashboard');
    } catch (error) {
      setMessage(`로그인 요청 실패: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-3xl font-bold">로그인</h1>
        <p className="mt-2 text-sm text-slate-300">계정으로 로그인합니다.</p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <input
            type="text"
            placeholder="사번"
            value={idnum}
            onChange={(e) => setIdnum(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none"
            required
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-60"
          >
            {loading ? '처리 중...' : '로그인'}
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-cyan-300">{message}</p>}

        <p className="mt-6 text-sm text-slate-300">
          계정이 없으면{' '}
          <Link href="/signup" className="text-cyan-300 underline">
            회원가입
          </Link>
        </p>
      </div>
    </main>
  );
}
