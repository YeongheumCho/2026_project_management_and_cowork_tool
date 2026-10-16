import { redirect } from 'next/navigation';

// 예전 "팀 관리" 자리표시 화면. 내용 없이 어두운 화면만 보였다.
// 팀원 관리는 관리 탭(사용자 권한 관리)에 있으므로 그쪽으로 보낸다.
export default function TeamPage() {
  redirect('/admin');
}
