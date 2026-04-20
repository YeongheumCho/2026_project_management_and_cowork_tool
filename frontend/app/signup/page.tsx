'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE_URL = 'http://127.0.0.1:8000';

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
  const [role, setRole] = useState<'admin' | 'member'>('member');

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idnum, name, password, role }),
      });

      const data: ApiError = await res.json();

      if (!res.ok) {
        setMessage(getErrorMessage(data, '회원가입에 실패했습니다.'));
        return;
      }

      setMessage('회원가입 성공! 로그인 페이지로 이동합니다.');
      setTimeout(() => {
        router.push('/login');
      }, 800);
    } catch (error) {
      setMessage(`회원가입 요청 실패: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-3xl font-bold">회원가입</h1>
        <p className="mt-2 text-sm text-slate-300">협업 툴 계정을 생성합니다.</p>

        <form onSubmit={handleSignup} className="mt-6 space-y-4">
          <input
            type="text"
            placeholder="사번"
            value={idnum}
            onChange={(e) => setIdnum(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none"
            required
          />
          <input
            type="text"
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
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

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRole('member')}
              className={`flex-1 rounded-2xl border px-4 py-3 text-sm ${
                role === 'member'
                  ? 'border-cyan-300 bg-cyan-300 text-slate-950'
                  : 'border-white/10 bg-slate-900 text-white'
              }`}
            >
              일반 직원
            </button>
            <button
              type="button"
              onClick={() => setRole('admin')}
              className={`flex-1 rounded-2xl border px-4 py-3 text-sm ${
                role === 'admin'
                  ? 'border-cyan-300 bg-cyan-300 text-slate-950'
                  : 'border-white/10 bg-slate-900 text-white'
              }`}
            >
              관리자
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-60"
          >
            {loading ? '처리 중...' : '회원가입'}
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-cyan-300">{message}</p>}

        <p className="mt-6 text-sm text-slate-300">
          이미 계정이 있으면{' '}
          <Link href="/login" className="text-cyan-300 underline">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
