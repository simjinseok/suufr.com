'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  HomeIcon,
  BookUserIcon,
  NotebookTextIcon,
  CalendarDaysIcon,
  ReceiptIcon,
  UserRoundCheckIcon,
  CalendarIcon,
} from 'lucide-react';

const menuItems = [
  { href: '/dashboard', label: '메인', icon: HomeIcon },
  { href: '/students', label: '수강생', icon: BookUserIcon },
  { href: '/payments', label: '입금내역', icon: ReceiptIcon },
  { href: '/meetings', label: '상담', icon: UserRoundCheckIcon },
  { href: '/calendar', label: '캘린더', icon: CalendarIcon },
];

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
      {menuItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/' && pathname.startsWith(item.href + '/'));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
              transition-all duration-200
              ${
                isActive
                  ? 'text-indigo-700 bg-white/80 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }
            `}
          >
            <item.icon
              className={`w-[18px] h-[18px] ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}
              strokeWidth={isActive ? 2 : 1.5}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
