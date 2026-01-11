'use client';
import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button, ListBox, Surface } from '@heroui/react';
import SidebarDrawer from './sidebar-drawer';
import {
  BookUserIcon,
  CalendarDaysIcon,
  HomeIcon,
  NotebookTextIcon,
  ReceiptIcon,
  UserRoundCheckIcon,
} from 'lucide-react';
import Link from 'next/link';

export default function Layout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [isOpen, onOpenChange] = React.useState(false);

  const content = (
    <Surface className="relative flex h-full w-72 flex-1 flex-col p-6">
      <ListBox
        aria-label="메인메뉴"
        className="list-none"
        disallowEmptySelection
        selectedKeys={[pathname.split('/')[1]]}
        selectionMode="single"
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0];
          router.push(`/${key}`);

          // setSelected(key as React.Key);
          // onSelect?.(key as string);
        }}
      >
        <ListBox.Item id="">
          <HomeIcon />
          메인
        </ListBox.Item>
        <ListBox.Item id="students" textValue="student">
          <BookUserIcon />
          수강생
        </ListBox.Item>
        <ListBox.Item id="lessons">
          <NotebookTextIcon />
          레슨
        </ListBox.Item>
        <ListBox.Item id="sessions">
          <CalendarDaysIcon />
          수업
        </ListBox.Item>
        <ListBox.Item id="payments">
          <ReceiptIcon />
          입금내역
        </ListBox.Item>
        <ListBox.Item id="meetings">
          <UserRoundCheckIcon />
          상담
        </ListBox.Item>
        <ListBox.Item id="calendar">
          <CalendarDaysIcon />
          캘린더
        </ListBox.Item>
      </ListBox>
    </Surface>
  );
  return (
    <div className="flex h-dvh w-full">
      {/* <SidebarDrawer */}
      {/*  className=" !border-r-small border-divider" */}
      {/*  isOpen={isOpen} */}
      {/*  onOpenChange={onOpenChange} */}
      {/* > */}
      {/*  {content} */}
      {/* </SidebarDrawer> */}
      <div>
        {content}
      </div>
      <div className="w-full flex-1 flex-col p-4 overflow-auto">
        <main className="mt-4 mx-auto h-full w-full max-w-3xl">
          {children}
        </main>
      </div>
    </div>
  );
}
