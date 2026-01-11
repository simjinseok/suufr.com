'use client';

import { LogOutIcon, UserIcon } from 'lucide-react';

export function UserMenu() {
  return (
    <div className="px-3 pb-4 mt-auto">
      <button
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
