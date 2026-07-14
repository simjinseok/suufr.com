import Link from 'next/link';
import { ChevronRight, CreditCard, Link2, Shield } from 'lucide-react';

import { getUserSettings } from '@/utils/user-settings';

import SettingsForm from './_settings-form';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const settings = await getUserSettings();

  return (
    <div>
      <h1 className="text-2xl font-bold">설정</h1>
      <div className="mt-6 flex flex-col gap-6">
        <SettingsForm settings={settings} />

        <Link
          href="/settings/subscription"
          className="flex items-center justify-between p-5 border border-gray-50 rounded-xl shadow-xs bg-white hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <CreditCard className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">요금제</h2>
              <p className="text-sm text-gray-500">플랜, 사용량 및 결제 관리</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>

        <Link
          href="/settings/integrations"
          className="flex items-center justify-between p-5 border border-gray-50 rounded-xl shadow-xs bg-white hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Link2 className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">연동 설정</h2>
              <p className="text-sm text-gray-500">Google Calendar, Contacts 연동</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>

        <Link
          href="/settings/security"
          className="flex items-center justify-between p-5 border border-gray-50 rounded-xl shadow-xs bg-white hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Shield className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">보안 설정</h2>
              <p className="text-sm text-gray-500">앱 토큰 관리 및 외부 앱 연동</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>
      </div>
    </div>
  );
}
