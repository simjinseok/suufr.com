import { redirect } from 'next/navigation';
import { Nanum_Myeongjo } from 'next/font/google';
import { getSession } from '@/utils/auth';
import './print.css';

// 인쇄 전용 라우트 그룹: 사이드바·배너 없음. 세션만 확인한다(비로그인은 proxy.ts 가 먼저 /login 으로 보냄).
const myeongjo = Nanum_Myeongjo({ weight: ['400', '700', '800'], subsets: ['latin'], variable: '--font-myeongjo' });

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <div className={`${myeongjo.variable} print-root min-h-screen bg-zinc-100 text-zinc-900`}>
      {children}
    </div>
  );
}
