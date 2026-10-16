'use client';

import { useEffect, useState } from 'react';
import { apiFetch, type Me } from './api';

/*
 * 로그인한 사용자의 팀 이름.
 *
 * B-98: 인원 선택기가 처음 열릴 때 내 팀을 펼쳐 두려면 이 값이 필요하다.
 * 선택기를 쓰는 화면이 많아 화면마다 넘기는 대신 여기서 한 번만 받아 나눠 쓴다.
 * 토큰이 바뀌면(다른 계정으로 로그인) 다시 받는다.
 */
let cache: { token: string; team: Promise<string | null> } | null = null;

function loadMyTeam(): Promise<string | null> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : null;
  if (!token) return Promise.resolve(null);
  if (cache?.token !== token) {
    const team = apiFetch<Me>('/auth/me')
      .then((me) => me.team ?? null)
      .catch(() => {
        cache = null;
        return null;
      });
    cache = { token, team };
  }
  return cache.team;
}

export function useMyTeam(enabled = true): string | null {
  const [team, setTeam] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadMyTeam().then((next) => {
      if (alive) setTeam(next);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return team;
}
