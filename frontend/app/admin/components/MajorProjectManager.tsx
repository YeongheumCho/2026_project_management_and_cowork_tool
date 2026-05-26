'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import OrganizationMemberPicker from '../../components/OrganizationMemberPicker';
import {
  apiFetch,
  PROJECT_TYPE_LABEL,
  PROJECT_TYPE_OPTIONS,
  type MajorProject,
  type UserBrief,
} from '../../lib/api';
import { clampDateYear, MAX_DATE_VALUE } from '../../lib/dateInput';

type Props = {
  users: UserBrief[];
};

type MajorProjectForm = {
  name: string;
  start_date: string;
  end_date: string;
  project_types: string[];
  member_ids: number[];
};

function createEmptyForm(): MajorProjectForm {
  return {
    name: '',
    start_date: '',
    end_date: '',
    project_types: [...PROJECT_TYPE_OPTIONS],
    member_ids: [],
  };
}

function typeLabel(value: string) {
  return PROJECT_TYPE_LABEL[value] ?? value;
}

export default function MajorProjectManager({ users }: Props) {
  const [items, setItems] = useState<MajorProject[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<MajorProjectForm>(() => createEmptyForm());
  const [typeDraft, setTypeDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'error' | 'success'>('error');
  const formRef = useRef<HTMLFormElement | null>(null);

  const editing = useMemo(
    () => items.find((item) => item.id === editingId) ?? null,
    [editingId, items],
  );

  async function load(options: { keepMessage?: boolean } = {}) {
    setLoading(true);
    try {
      setItems(await apiFetch<MajorProject[]>('/major-projects'));
      if (!options.keepMessage) setMessage('');
    } catch (error) {
      setMessageTone('error');
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function startEdit(item: MajorProject) {
    setEditingId(item.id);
    setTypeDraft('');
    setForm({
      name: item.name,
      start_date: item.start_date ?? '',
      end_date: item.end_date ?? '',
      project_types: item.project_types?.length ? item.project_types : [...PROJECT_TYPE_OPTIONS],
      member_ids: item.members.map((member) => member.id),
    });
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  function reset() {
    setEditingId(null);
    setTypeDraft('');
    setForm(createEmptyForm());
  }

  function addProjectType() {
    const nextType = typeDraft.trim();
    if (!nextType) return;
    if (form.project_types.includes(nextType)) {
      setMessageTone('error');
      setMessage('이미 추가된 프로젝트 유형입니다.');
      return;
    }
    setForm((prev) => ({
      ...prev,
      project_types: [...prev.project_types, nextType],
    }));
    setTypeDraft('');
    setMessage('');
  }

  function removeProjectType(type: string) {
    setForm((prev) => {
      if (prev.project_types.length <= 1) return prev;
      return {
        ...prev,
        project_types: prev.project_types.filter((item) => item !== type),
      };
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setMessageTone('error');
      setMessage('종료일은 시작일 이후여야 합니다.');
      return;
    }
    if (form.project_types.length === 0) {
      setMessageTone('error');
      setMessage('프로젝트 유형을 1개 이상 추가해주세요.');
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        project_types: form.project_types,
        member_ids: form.member_ids,
      };
      if (editingId) {
        await apiFetch<MajorProject>(`/major-projects/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<MajorProject>('/major-projects', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setMessageTone('success');
      setMessage(editingId ? '대프로젝트를 수정했습니다.' : '대프로젝트를 추가했습니다.');
      reset();
      await load({ keepMessage: true });
    } catch (error) {
      setMessageTone('error');
      setMessage((error as Error).message);
    }
  }

  async function remove(item: MajorProject) {
    if (!window.confirm(`"${item.name}" 대프로젝트를 삭제할까요?`)) return;
    try {
      await apiFetch<void>(`/major-projects/${item.id}`, { method: 'DELETE' });
      await load();
      if (editingId === item.id) reset();
    } catch (error) {
      setMessageTone('error');
      setMessage((error as Error).message);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-white p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-text">대프로젝트 관리</h2>
        <p className="mt-1 text-small text-text-subtle">
          계약 단위의 대프로젝트와 참여 인원, 생성 가능한 프로젝트 유형을 관리합니다.
        </p>
      </div>

      {message && (
        <p
          className={`mb-3 rounded-lg px-3 py-2 text-sm ${
            messageTone === 'success'
              ? 'bg-verify-pass-bg text-verify-pass-fg'
              : 'bg-red-50 text-red-600'
          }`}
        >
          {message}
        </p>
      )}

      <form ref={formRef} onSubmit={submit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="text-small font-semibold text-text-subtle">대프로젝트명</span>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-body"
            />
          </label>
          <DateField
            label="시작일"
            value={form.start_date}
            onChange={(value) => setForm((prev) => ({ ...prev, start_date: value }))}
          />
          <DateField
            label="종료일"
            value={form.end_date}
            onChange={(value) => setForm((prev) => ({ ...prev, end_date: value }))}
          />

          <div className="md:col-span-2 rounded-xl border border-border bg-surface-muted p-3">
            <p className="text-small font-bold text-text">프로젝트 유형</p>
            <div className="mt-2 flex gap-2">
              <input
                value={typeDraft}
                onChange={(event) => setTypeDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  addProjectType();
                }}
                placeholder="예: 고객 검증, 양산 대응"
                className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2 text-small text-text"
              />
              <button
                type="button"
                onClick={addProjectType}
                className="rounded-lg bg-brand px-3 py-2 text-small font-bold text-white"
              >
                추가
              </button>
            </div>
            <div className="mt-3 flex max-h-[104px] flex-wrap gap-2 overflow-y-auto pr-1">
              {form.project_types.map((type) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-soft bg-white px-3 py-1.5 text-small font-semibold text-brand"
                >
                  {typeLabel(type)}
                  <button
                    type="button"
                    onClick={() => removeProjectType(type)}
                    disabled={form.project_types.length <= 1}
                    className="text-text-subtle transition hover:text-verify-fail-fg disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`${typeLabel(type)} 삭제`}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 text-small font-bold text-white"
            >
              {editing ? '대프로젝트 저장' : '대프로젝트 추가'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-border px-4 py-2 text-small font-bold text-brand"
              >
                취소
              </button>
            )}
          </div>
        </div>

        <div className="min-h-[260px] overflow-hidden rounded-2xl border border-border bg-surface-muted p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-small font-bold text-text">참여 인원</p>
            <span className="text-small text-text-subtle">
              {form.member_ids.length}/{users.length}명
            </span>
          </div>
          <div className="max-h-[300px] overflow-y-auto pr-1">
            <OrganizationMemberPicker
              users={users}
              selectedIds={form.member_ids}
              onChange={(member_ids) => setForm((prev) => ({ ...prev, member_ids }))}
            />
          </div>
        </div>
      </form>

      <div className="mt-5 space-y-2">
        {loading && <p className="text-small text-text-subtle">불러오는 중...</p>}
        {!loading &&
          items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-bold text-text">
                  {item.name}
                  {item.is_default && (
                    <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-tiny text-brand">
                      기본
                    </span>
                  )}
                </p>
                <p className="mt-1 text-small text-text-subtle">
                  {item.start_date ?? '-'} ~ {item.end_date ?? '-'} · 참여 {item.members.length}명 · 중프로젝트 {item.project_count}건
                </p>
                <div className="mt-2 flex max-h-[68px] flex-wrap gap-1.5 overflow-y-auto pr-1">
                  {(item.project_types?.length ? item.project_types : PROJECT_TYPE_OPTIONS).map((type) => (
                    <span
                      key={type}
                      className="rounded-full bg-white px-2 py-0.5 text-tiny font-semibold text-text-muted"
                    >
                      {typeLabel(type)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className="rounded-lg border border-brand-soft bg-white px-3 py-1.5 text-small font-bold text-brand"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => remove(item)}
                  disabled={item.is_default || item.project_count > 0}
                  className="rounded-lg border border-verify-fail-bg bg-white px-3 py-1.5 text-small font-bold text-verify-fail-fg disabled:cursor-not-allowed disabled:opacity-40"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-small font-semibold text-text-subtle">{label}</span>
      <input
        type="date"
        value={value}
        max={MAX_DATE_VALUE}
        onInput={(event) => {
          event.currentTarget.value = clampDateYear(event.currentTarget.value);
        }}
        onChange={(event) => onChange(clampDateYear(event.target.value))}
        className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-body"
      />
    </label>
  );
}
