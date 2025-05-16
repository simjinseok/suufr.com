'use client';
import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn, Listbox, ListboxItem, useDisclosure } from '@heroui/react';
import SidebarDrawer from './sidebar-drawer';
import {
  BookUserIcon,
  CalendarDaysIcon,
  HomeIcon,
  NotebookTextIcon,
  ReceiptIcon,
  UserRoundCheckIcon
} from 'lucide-react';

export default function Layout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const content = (
    <div className="relative flex h-full w-72 flex-1 flex-col p-6">
      <Listbox
        hideSelectedIcon
        as="nav"
        label="메인메뉴"
        className="list-none"
        classNames={{
          list: 'items-center',
        }}
        itemClasses={{
          base: 'px-3 min-h-11 rounded-large h-[44px] data-[selected=true]:bg-default-100',
          title: 'text-small font-medium text-default-500 group-data-[selected=true]:text-foreground',
        }}
        color="default"
        selectedKeys={[pathname.split('/')[1]]}
        selectionMode="single"
        variant="flat"
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0];
          console.log('gdgd?', key);
          router.push(`/${key}`);

          // setSelected(key as React.Key);
          // onSelect?.(key as string);
        }}
      >
        <ListboxItem
          key=""
          title="메인"
          startContent={<HomeIcon />}
        />
        <ListboxItem
          key="students"
          title="수강생"
          startContent={<BookUserIcon />}
        />
        <ListboxItem
          key="syllabuses"
          title="계획"
          startContent={<NotebookTextIcon />}
          classNames={{
            title: 'text-small font-medium text-default-500 group-data-[selected=true]:text-foreground',
          }}
        />
        <ListboxItem
          key="lessons"
          title="수업"
          startContent={<CalendarDaysIcon />}
          classNames={{
            title: 'text-small font-medium text-default-500 group-data-[selected=true]:text-foreground',
          }}
        />
        <ListboxItem
          key="payments"
          title="입금내역"
          startContent={<ReceiptIcon />}
          classNames={{
            title: 'text-small font-medium text-default-500 group-data-[selected=true]:text-foreground',
          }}
        />
        <ListboxItem
          key="meetings"
          title="상담"
          startContent={<UserRoundCheckIcon />}
          classNames={{
            title: 'text-small font-medium text-default-500 group-data-[selected=true]:text-foreground',
          }}
        />
      </Listbox>
    </div>
  );
  return (
    <div className="flex h-dvh w-full">
      <SidebarDrawer
        className=" !border-r-small border-divider"
        isOpen={isOpen}
        onOpenChange={onOpenChange}
      >
        {content}
      </SidebarDrawer>
      <div className="w-full flex-1 flex-col p-4">
        <main className="mt-4 h-full w-full overflow-visible">
          {children}
        </main>
      </div>
    </div>
  );
}
