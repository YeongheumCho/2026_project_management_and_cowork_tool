'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
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

  const editing = useMemo(
    () => items.find((item) => item.id === editingId) ?? null,
    [editingId, items],
  );

  async function load() {
    setLoading(true);
    try {
      setItems(await apiFetch<MajorProject[]>('/major-projects'));
      setMessage('');
    } catch (error) {
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
      setMessage('종료일은 시작일 이후여야 합니다.');
      return;
    }
    if (form.project_types.length === 0) {
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
      reset();
      await load();
    } catch (error) {
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
      setMessage((error as Error).message);
    }
  }

  return (
    <section className="rounded-2xl border border-[#EAEAE4] bg-white p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[#1A1A1A]">대프로젝트 관리</h2>
        <p className="mt-1 text-small text-[#888780]">
          계약 단위의 대프로젝트와 참여 인원, 생성 가능한 프로젝트 유형을 관리합니다.
        </p>
      </div>

      {message && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {message}
        </p>
      )}

      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="text-small font-semibold text-[#888780]">대프로젝트명</span>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#EAEAE4] px-3 py-2 text-body"
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

          <div className="md:col-span-2 rounded-xl border border-[#EAEAE4] bg-[#FAFAFA] p-3">
            <p className="text-small font-bold text-[#1A1A1A]">프로젝트 유형</p>
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
                className="min-w-0 flex-1 rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-small text-[#1A1A1A]"
              />
              <button
                type="button"
                onClick={addProjectType}
                className="rounded-lg bg-[#534AB7] px-3 py-2 text-small font-bold text-white"
              >
                추가
              </button>
            </div>
            <div className="mt-3 flex max-h-[104px] flex-wrap gap-2 overflow-y-auto pr-1">
              {form.project_types.map((type) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-2 rounded-full border border-[#D8D3FF] bg-white px-3 py-1.5 text-small font-semibold text-[#534AB7]"
                >
                  {typeLabel(type)}
                  <button
                    type="button"
                    onClick={() => removeProjectType(type)}
                    disabled={form.project_types.length <= 1}
                    className="text-[#888780] transition hover:text-[#A32D2D] disabled:cursor-not-allowed disabled:opacity-40"
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
              className="rounded-lg bg-[#534AB7] px-4 py-2 text-small font-bold text-white"
            >
              {editing ? '대프로젝트 저장' : '대프로젝트 추가'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-[#EAEAE4] px-4 py-2 text-small font-bold text-[#534AB7]"
              >
                취소
              </button>
            )}
          </div>
        </div>

        <div className="min-h-[260px] overflow-hidden rounded-2xl border border-[#EAEAE4] bg-[#FAFAFA] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-small font-bold text-[#1A1A1A]">참여 인원</p>
            <span className="text-small text-[#888780]">
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
        {loading && <p className="text-small text-[#888780]">불러오는 중...</p>}
        {!loading &&
          items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EAEAE4] bg-[#FAFAFA] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-bold text-[#1A1A1A]">
                  {item.name}
                  {item.is_default && (
                    <span className="ml-2 rounded-full bg-[#EEEDFE] px-2 py-0.5 text-tiny text-[#534AB7]">
                      기본
                    </span>
                  )}
                </p>
                <p className="mt-1 text-small text-[#888780]">
                  {item.start_date ?? '-'} ~ {item.end_date ?? '-'} · 참여 {item.members.length}명 · 중프로젝트 {item.project_count}건
                </p>
                <div className="mt-2 flex max-h-[68px] flex-wrap gap-1.5 overflow-y-auto pr-1">
                  {(item.project_types?.length ? item.project_types : PROJECT_TYPE_OPTIONS).map((type) => (
                    <span
                      key={type}
                      className="rounded-full bg-white px-2 py-0.5 text-tiny font-semibold text-[#5F5E5A]"
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
                  className="rounded-lg border border-[#D8D3FF] bg-white px-3 py-1.5 text-small font-bold text-[#534AB7]"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => remove(item)}
                  disabled={item.is_default || item.project_count > 0}
                  className="rounded-lg border border-[#F4C9C9] bg-white px-3 py-1.5 text-small font-bold text-[#A32D2D] disabled:cursor-not-allowed disabled:opacity-40"
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
      <span className="text-small font-semibold text-[#888780]">{label}</span>
      <input
        type="date"
        value={value}
        max={MAX_DATE_VALUE}
        onInput={(event) => {
          event.currentTarget.value = clampDateYear(event.currentTarget.value);
        }}
        onChange={(event) => onChange(clampDateYear(event.target.value))}
        className="mt-1 w-full rounded-lg border border-[#EAEAE4] px-3 py-2 text-body"
      />
    </label>
  );
}
