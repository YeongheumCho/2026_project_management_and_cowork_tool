'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE_URL = 'http://127.0.0.1:8000';

type ProgressLog = {
  id: number;
  project_id: number;
  user_id: number;
  progress_percent: number;
  comment: string | null;
  work_date: string;
  created_at: string;
};

type Project = {
  id: number;
  name: string;
  description: string | null;
  created_by: number;
  created_at: string;
};

function getErrorMessage(data: any, defaultMessage: string) {
  if (!data) return defaultMessage;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map((item: any) => item.msg).join(', ');
  }
  return defaultMessage;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [progressLogs, setProgressLogs] = useState<ProgressLog[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const [progressPercent, setProgressPercent] = useState('');
  const [progressComment, setProgressComment] = useState('');
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));

  const getToken = () => localStorage.getItem('access_token');

  const fetchProjects = async () => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    const res = await fetch(`${API_BASE_URL}/projects`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(getErrorMessage(data, '프로젝트 목록을 불러오지 못했습니다.'));
      return;
    }

    const foundProject = data.find((item: Project) => item.id === Number(projectId));
    if (!foundProject) {
      setMessage('프로젝트를 찾을 수 없습니다.');
      return;
    }

    setProject(foundProject);
  };

  const fetchProgressLogs = async () => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/progress`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(getErrorMessage(data, '진행 기록을 불러오지 못했습니다.'));
      return;
    }

    setProgressLogs(data);
  };

  useEffect(() => {
    const init = async () => {
      try {
        await fetchProjects();
        await fetchProgressLogs();
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [projectId]);

  const handleCreateProgressLog = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      const token = getToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          progress_percent: Number(progressPercent),
          comment: progressComment || null,
          work_date: workDate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(getErrorMessage(data, '진행 기록 저장에 실패했습니다.'));
        return;
      }

      setMessage('진행 기록이 저장되었습니다.');
      setProgressPercent('');
      setProgressComment('');
      await fetchProgressLogs();
    } catch (error) {
      setMessage(`진행 기록 저장 실패: ${String(error)}`);
    }
  };

  if (loading) {
    return <main className="p-8 text-slate-900">불러오는 중...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-sm text-blue-600 hover:underline"
            >
              ← 대시보드로 돌아가기
            </Link>
            <h1 className="mt-2 text-3xl font-bold">{project?.name}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {project?.description || '설명 없음'}
            </p>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">진행률 기록 작성</h2>
            <p className="mt-2 text-sm text-slate-500">
              오늘 프로젝트에서 진행한 내용을 기록하세요.
            </p>

            <form onSubmit={handleCreateProgressLog} className="mt-4 space-y-4">
              <input
                type="number"
                min="0"
                max="100"
                placeholder="진행률 (%)"
                value={progressPercent}
                onChange={(e) => setProgressPercent(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                required
              />

              <input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                required
              />

              <textarea
                placeholder="오늘 한 일 / 메모"
                value={progressComment}
                onChange={(e) => setProgressComment(e.target.value)}
                className="min-h-32 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />

              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
              >
                진행 기록 저장
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">진행 기록 목록</h2>
            <p className="mt-2 text-sm text-slate-500">
              이 프로젝트에 대한 내 진행 기록
            </p>

            <div className="mt-4 space-y-3">
              {progressLogs.length === 0 ? (
                <p className="text-sm text-slate-500">아직 기록이 없습니다.</p>
              ) : (
                progressLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{log.progress_percent}%</p>
                      <p className="text-xs text-slate-500">{log.work_date}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {log.comment || '메모 없음'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
