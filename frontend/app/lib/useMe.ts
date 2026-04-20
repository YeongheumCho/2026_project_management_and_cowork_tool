'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, type Me } from './api';

/**
 * /auth/me를 호출해 현재 사용자를 가져오는 훅.
 * 토큰이 없거나 유효하지 않으면 /login으로 리다이렉트.
 */
export function useMe() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = window.localStorage.getItem('access_token');
        if (!token) {
          router.replace('/login');
          return;
        }
        const data = await apiFetch<Me>('/auth/me');
        if (!cancelled) setMe(data);
      } catch {
        window.localStorage.removeItem('access_token');
        router.replace('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { me, loading };
}
