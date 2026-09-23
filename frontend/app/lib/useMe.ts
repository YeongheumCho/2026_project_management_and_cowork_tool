'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, isAuthError, type Me } from './api';

/** 일시적 오류일 때 다시 시도하는 횟수와 간격 */
const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * /auth/me를 호출해 현재 사용자를 가져오는 훅.
 *
 * B-91: 예전에는 어떤 오류든 토큰을 지우고 /login 으로 보냈다.
 * 그래서 백엔드 재시작이나 순간적인 네트워크 끊김만으로도 로그아웃돼,
 * 토큰 수명이 8시간인데도 "1시간 안에 세션이 끊긴다"고 느껴졌다.
 * 이제 인증이 실제로 끊긴 경우(401)에만 로그아웃하고,
 * 그 밖의 오류는 잠시 뒤 다시 시도한다.
 */
export function useMe() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const signOut = () => {
      window.localStorage.removeItem('access_token');
      router.replace('/login');
    };

    (async () => {
      const token = window.localStorage.getItem('access_token');
      if (!token) {
        router.replace('/login');
        return;
      }

      for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
        if (cancelled) return;
        try {
          const data = await apiFetch<Me>('/auth/me');
          if (!cancelled) {
            setMe(data);
            setLoading(false);
          }
          return;
        } catch (error) {
          if (isAuthError(error)) {
            if (!cancelled) signOut();
            return;
          }
          // 일시적 오류 — 토큰은 그대로 두고 다시 시도한다.
          if (attempt < RETRY_COUNT) await sleep(RETRY_DELAY_MS);
        }
      }

      // 계속 실패하면 세션을 지우지 않고 로딩만 끝낸다. 새로고침하면 다시 시도한다.
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return { me, loading };
}
