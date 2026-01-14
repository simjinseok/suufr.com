'use client';

import { useState } from 'react';
import { MenuIcon, XIcon } from 'lucide-react';
import { AppNavigation } from '@/components/app-navigation';
import { UserMenu } from './_user-menu';

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);

  const sidebarContent = (
    <>
      <div className="h-16 flex items-center px-5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600
                        flex items-center justify-center shadow-lg shadow-indigo-500/30"
          >
            <span className="text-sm font-bold text-white">스</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">스프</h1>
        </div>
      </div>
      <AppNavigation />
      <UserMenu />
    </>
  );

  return (
    <>
      {/* 모바일 햄버거 버튼 */}
      <button
        type="button"
        className="sm:hidden fixed top-5 left-5 z-50 p-2 rounded-xl bg-white/80 backdrop-blur-sm shadow-md"
        onClick={() => setIsOpen(true)}
      >
        <MenuIcon className="w-5 h-5 text-gray-700" />
      </button>

      {/* 모바일 오버레이 */}
      {isOpen && (
        <div
          className="sm:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 모바일 사이드바 */}
      <aside
        className={`
          sm:hidden fixed top-0 left-0 h-full w-72 z-50
          flex flex-col
          bg-white/90 backdrop-blur-xl
          border-r border-white/60
          shadow-[0_8px_32px_rgba(0,0,0,0.12)]
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <button
          type="button"
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100"
          onClick={() => setIsOpen(false)}
        >
          <XIcon className="w-5 h-5 text-gray-500" />
        </button>
        {sidebarContent}
      </aside>

      {/* 데스크탑 고정 사이드바 */}
      <aside
        className="hidden sm:flex w-72 flex-col rounded-2xl
                   bg-white/70 backdrop-blur-xl
                   border border-white/60
                   shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
