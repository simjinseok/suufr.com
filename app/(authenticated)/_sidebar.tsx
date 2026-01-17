'use client';

import {
  MenuIcon,
  UserIcon,
  LogOutIcon,
  HomeIcon,
  BookUserIcon,
  ReceiptIcon,
  UserRoundCheckIcon,
  CalendarIcon,
  SettingsIcon,
} from 'lucide-react';
import {Button, Dropdown, Separator} from '@heroui/react';
import { AppNavigation } from '@/components/app-navigation';
import { UserMenu } from './_user-menu';

export function Sidebar() {
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
      {/* 모바일 헤더 */}
      <header className="sm:hidden fixed top-0 left-0 right-0 z-50 h-14 px-4 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600
                        flex items-center justify-center shadow-md shadow-indigo-500/25"
          >
            <span className="text-xs font-bold text-white">스</span>
          </div>
          <h1 className="text-base font-semibold text-gray-900 tracking-tight">스프</h1>
        </div>

        <div className="flex items-center gap-1">
          {/* 유저 프로필 드롭다운 */}
          <Dropdown>
            <Button variant="ghost" isIconOnly size="sm">
              <div className="w-6 h-6 rounded-full bg-linear-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <UserIcon className="w-3.5 h-3.5 text-gray-500" />
              </div>
            </Button>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu aria-label="유저 메뉴">
                <Dropdown.Item id="settings" href="/settings" textValue="설정">
                  <SettingsIcon className="w-4 h-4" />
                  설정
                </Dropdown.Item>
                <Separator />
                <Dropdown.Item id="logout" href="/auth/logout" textValue="로그아웃">
                  <LogOutIcon className="w-4 h-4" />
                  로그아웃
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          {/* 햄버거 메뉴 드롭다운 */}
          <Dropdown>
            <Button variant="ghost" isIconOnly size="sm">
              <MenuIcon className="w-5 h-5 text-gray-700" />
            </Button>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu aria-label="메뉴">
                <Dropdown.Item id="dashboard" href="/dashboard" textValue="메인">
                  <HomeIcon className="w-4 h-4" />
                  메인
                </Dropdown.Item>
                <Dropdown.Item id="students" href="/students" textValue="수강생">
                  <BookUserIcon className="w-4 h-4" />
                  수강생
                </Dropdown.Item>
                <Dropdown.Item id="payments" href="/payments" textValue="입금내역">
                  <ReceiptIcon className="w-4 h-4" />
                  입금내역
                </Dropdown.Item>
                <Dropdown.Item id="meetings" href="/meetings" textValue="상담">
                  <UserRoundCheckIcon className="w-4 h-4" />
                  상담
                </Dropdown.Item>
                <Dropdown.Item id="calendar" href="/calendar" textValue="캘린더">
                  <CalendarIcon className="w-4 h-4" />
                  캘린더
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </header>

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
