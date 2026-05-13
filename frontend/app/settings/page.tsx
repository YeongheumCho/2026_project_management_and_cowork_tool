'use client';

import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';
import { apiFetch, type UserSettings } from '../lib/api';
import { useMe } from '../lib/useMe';

export default function SettingsPage() {
  const { me, loading: meLoading } = useMe();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [name, setName] = useState('');
  const [defaultCalendarView, setDefaultCalendarView] = useState<
    'team' | 'personal'
  >('team');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!me) return;
    void loadSettings();
  }, [me]);

  async function loadSettings() {
    try {
      const response = await apiFetch<UserSettings>('/settings/me');
      setSettings(response);
      setName(response.name);
      setDefaultCalendarView(response.default_calendar_view);
      setNotificationsEnabled(response.notifications_enabled);
      setError('');
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const response = await apiFetch<UserSettings>('/settings/me', {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          current_password: currentPassword || undefined,
          new_password: newPassword || undefined,
          default_calendar_view: defaultCalendarView,
          notifications_enabled: notificationsEnabled,
        }),
      });
      setSettings(response);
      setCurrentPassword('');
      setNewPassword('');
      setMessage('설정이 저장되었습니다.');
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (meLoading || !me) {
    return <main className="p-8 text-text">불러오는 중...</main>;
  }

  return (
    <AppShell me={me}>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      )}

      <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text">설정</h1>
          <p className="mt-2 text-sm text-text-subtle">
            사용자 정보, 기본 캘린더 뷰, 알림 여부를 관리할 수 있습니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2">
            <Field label="이름">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="사번">
              <input
                value={settings?.idnum ?? me.idnum}
                disabled
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2.5 text-sm text-text-subtle"
              />
            </Field>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Field label="현재 비밀번호">
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="새 비밀번호">
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              />
            </Field>
          </section>

          <section className="rounded-2xl border border-border bg-surface-muted p-4">
            <p className="text-sm font-semibold text-text">
              기본 캘린더 뷰
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['team', 'personal'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDefaultCalendarView(value)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium ${
                    defaultCalendarView === value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-text'
                  }`}
                >
                  {value === 'team' ? '팀 캘린더' : '개인 캘린더'}
                </button>
              ))}
            </div>
          </section>

          <label className="flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-text">알림 사용</p>
              <p className="mt-1 text-xs text-text-subtle">
                추천 완료, 작업 상태 변경 같은 주요 이벤트를 표시합니다.
              </p>
            </div>
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(event) => setNotificationsEnabled(event.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? '저장 중...' : '설정 저장'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-text">
        {label}
      </span>
      {children}
    </label>
  );
}
