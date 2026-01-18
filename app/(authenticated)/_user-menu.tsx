'use client';

import { LogOutIcon, SettingsIcon, UserIcon, BuildingIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { OrganizationRole } from '@/prisma/generated/client';

type OrganizationItem = {
  id: number;
  uuid: string;
  name: string;
  role: OrganizationRole;
};

type Props = {
  currentOrg: OrganizationItem;
};

export function UserMenu({ currentOrg }: Props) {
  const router = useRouter();
  const isOwner = currentOrg.role === 'owner';

  const handleLogout = () => {
    router.push('/auth/logout');
  };

  return (
    <div className="px-3 pb-4 mt-auto flex flex-col gap-1">
      {isOwner && (
        <Link
          href={`/organizations/${currentOrg.uuid}/settings`}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                     text-gray-600 hover:text-gray-900 hover:bg-white/60
                     transition-all duration-200"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
            <BuildingIcon className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-gray-900">과외방 설정</p>
          </div>
        </Link>
      )}
      <Link
        href="/settings"
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                   text-gray-600 hover:text-gray-900 hover:bg-white/60
                   transition-all duration-200"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <SettingsIcon className="w-4 h-4 text-gray-500" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-gray-900">설정</p>
        </div>
      </Link>
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                   text-gray-600 hover:text-gray-900 hover:bg-white/60
                   transition-all duration-200"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <UserIcon className="w-4 h-4 text-gray-500" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-gray-900">사용자</p>
        </div>
        <LogOutIcon className="w-4 h-4 text-gray-400" />
      </button>
    </div>
  );
}
