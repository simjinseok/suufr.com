import Link from 'next/link';
import { Calendar, Clock, CreditCard, Users } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <span className="text-sm font-bold text-white">스</span>
            </div>
            <span className="text-lg font-bold text-gray-900">스프</span>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            로그인
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
            과외 관리,
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">
              더 간편하게
            </span>
          </h1>
          <p className="mt-6 text-lg text-gray-500 leading-relaxed">
            수업 일정부터 정산까지
            <br className="sm:hidden" />
            {' '}
            한 곳에서 관리하세요
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow"
            >
              무료로 시작하기
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
            >
              로그인
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
            이런 기능을 제공해요
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <FeatureCard
              icon={<Users className="w-6 h-6" />}
              title="학생 관리"
              description="학생별 정보와 수업 이력을 한눈에 확인하세요"
            />
            <FeatureCard
              icon={<Calendar className="w-6 h-6" />}
              title="일정 관리"
              description="캘린더로 수업 일정을 쉽게 관리하세요"
            />
            <FeatureCard
              icon={<Clock className="w-6 h-6" />}
              title="수업 기록"
              description="수업 내용과 진도를 체계적으로 기록하세요"
            />
            <FeatureCard
              icon={<CreditCard className="w-6 h-6" />}
              title="정산 관리"
              description="월별 수업료와 입금 내역을 관리하세요"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            지금 바로 시작하세요
          </h2>
          <p className="mt-4 text-gray-500">
            복잡한 과외 관리, 스프로 간편하게
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow"
          >
            무료로 시작하기
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <span className="text-xs font-bold text-white">스</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">스프</span>
          </div>
          <p className="text-sm text-gray-400">
            © 2025 Suufr. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-white rounded-2xl border border-gray-100">
      <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
