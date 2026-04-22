'use client';

import { useRouter } from 'next/navigation';
import AdminHeader from './components/AdminHeader';
import AdminSidebar from './components/AdminSidebar';
import TemplateManager from './components/TemplateManager';
import UserTable from './components/UserTable';
import { useAdminUsers } from './hooks/useAdminUsers';

/**
 * 관리자 페이지 라우트.
 *
 * 이 파일은 오케스트레이션만 담당한다 — 데이터 로딩/권한 편집 로직은
 * `hooks/useAdminUsers`, UI 블록은 `components/` 하위 파일로 분리되어 있어
 * 팀원별 동시 작업 시 충돌이 최소화된다.
 */
export default function AdminPage() {
  const router = useRouter();
  const {
    user,
    users,
    loading,
    savingId,
    message,
    handleRoleChange,
    handleRoleSave,
  } = useAdminUsers();

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    router.push('/login');
  };

  if (loading) {
    return <main className="p-8 text-slate-900">불러오는 중...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <AdminSidebar />

        <section className="flex-1 p-8">
          <AdminHeader user={user} onLogout={handleLogout} />

          <div className="mt-8 grid gap-6">
            <UserTable
              users={users}
              canEdit={user?.role === 'admin'}
              savingId={savingId}
              message={message}
              onRoleChange={handleRoleChange}
              onRoleSave={(m) => void handleRoleSave(m)}
            />
            <TemplateManager />
          </div>
        </section>
      </div>
    </main>
  );
}
