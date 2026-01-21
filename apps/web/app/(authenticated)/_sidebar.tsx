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
  ShieldIcon,
  BuildingIcon,
  ChevronsUpDownIcon,
  CheckIcon,
} from 'lucide-react';
import { Avatar, Button, Dropdown, Label, Separator } from '@heroui/react';
import { AppNavigation } from '@/components/app-navigation';
import { UserMenu } from './_user-menu';
import type { OrganizationRole } from '@/types';

type OrganizationItem = {
  id: number;
  uuid: string;
  name: string;
  role: OrganizationRole;
};

type MembershipItem = {
  id: number;
  uuid: string;
  name: string;
  role: OrganizationRole;
  profileImageKey: string | null;
};

type Props = {
  currentOrg: OrganizationItem;
  organizations: OrganizationItem[];
  membership: MembershipItem;
};

export function Sidebar({ currentOrg, organizations, membership }: Props) {
  const profileImageUrl = membership.profileImageKey
    ? `/assets/member/${membership.profileImageKey}.webp`
    : null;
  const memberInitial = membership.name.charAt(membership.name.length - 1);

  const handleMobileAction = (key: string | number) => {
    const keyStr = String(key);

    if (keyStr === 'settings') {
      window.location.href = '/settings';
    }
    else if (keyStr === 'security') {
      window.location.href = '/settings/security';
    }
    else if (keyStr === 'org-settings') {
      window.location.href = `/organizations/${currentOrg.uuid}/settings`;
    }
    else if (keyStr === 'logout') {
      window.location.href = '/auth/logout';
    }
    else {
      // 조직 선택
      const selectedOrg = organizations.find(org => org.uuid === keyStr);
      if (selectedOrg && selectedOrg.id !== currentOrg.id) {
        window.location.href = `/api/switch-organization/${selectedOrg.uuid}`;
      }
    }
  };
  const sidebarContent = (
    <>
      <div className="h-16 flex items-center px-5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl bg-linear-to-br from-violet-500 to-indigo-600
                        flex items-center justify-center shadow-lg shadow-indigo-500/30"
          >
            <span className="text-sm font-bold text-white">스</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">스프</h1>
        </div>
      </div>
      <AppNavigation />
      <UserMenu currentOrg={currentOrg} organizations={organizations} membership={membership} />
    </>
  );

  return (
    <>
      {/* 모바일 헤더 */}
      <header className="sm:hidden fixed top-0 left-0 right-0 z-50 h-14 px-4 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg bg-linear-to-br from-violet-500 to-indigo-600
                        flex items-center justify-center shadow-md shadow-indigo-500/25"
          >
            <span className="text-xs font-bold text-white">스</span>
          </div>
          <h1 className="text-base font-semibold text-gray-900 tracking-tight">스프</h1>
        </div>

        <div className="flex items-center gap-1">
          {/* 유저 프로필 + 조직 선택 통합 드롭다운 */}
          <Dropdown>
            <Button variant="ghost" className="h-auto py-1.5 px-2 gap-2">
              <Avatar className="size-6">
                {profileImageUrl ? (
                  <Avatar.Image src={profileImageUrl} alt={membership.name} />
                ) : null}
                <Avatar.Fallback className="text-[10px]">{memberInitial}</Avatar.Fallback>
              </Avatar>
              <div className="text-left">
                <p className="text-xs font-medium text-gray-900 max-w-20 truncate leading-tight">
                  {membership.name}
                </p>
                <p className="text-[10px] text-gray-500 max-w-20 truncate leading-tight">
                  {currentOrg.name}
                </p>
              </div>
              <ChevronsUpDownIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            </Button>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu aria-label="사용자 메뉴" onAction={handleMobileAction}>
                <Dropdown.Section title="과외방">
                  {organizations.map((org) => (
                    <Dropdown.Item
                      key={org.uuid}
                      id={org.uuid}
                      textValue={org.name}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-6 h-6 rounded-md bg-linear-to-br from-violet-100 to-indigo-100 flex items-center justify-center shrink-0">
                          <BuildingIcon className="w-3 h-3 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Label className="truncate">{org.name}</Label>
                        </div>
                        {org.id === currentOrg.id && (
                          <CheckIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                        )}
                      </div>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Section>
                <Separator />
                {currentOrg.role === 'owner' && (
                  <Dropdown.Item id="org-settings" textValue="학원 설정">
                    <div>
                      <BuildingIcon strokeWidth={1.5} className="size-5" />
                    </div>
                    <div>
                      <Label>학원 설정</Label>
                    </div>
                  </Dropdown.Item>
                )}
                <Dropdown.Item id="settings" textValue="계정 설정">
                  <div>
                    <SettingsIcon strokeWidth={1.5} className="size-5" />
                  </div>
                  <div>
                    <Label>계정 설정</Label>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="security" textValue="보안 설정">
                  <div>
                    <ShieldIcon strokeWidth={1.5} className="size-5" />
                  </div>
                  <div>
                    <Label>보안 설정</Label>
                  </div>
                </Dropdown.Item>
                <Separator />
                <Dropdown.Item id="logout" textValue="로그아웃">
                  <div>
                    <LogOutIcon strokeWidth={1.5} className="size-5" />
                  </div>
                  <div>
                    <Label>로그아웃</Label>
                  </div>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          {/* 햄버거 메뉴 드롭다운 */}
          <Dropdown>
            <Button variant="ghost" isIconOnly size="sm">
              <MenuIcon className="size-5 text-gray-700" />
            </Button>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu aria-label="메뉴">
                <Dropdown.Item id="dashboard" href="/dashboard" textValue="메인">
                  <div>
                    <HomeIcon strokeWidth={1.5} className="size-5" />
                  </div>
                  <div>
                    <Label>대시보드</Label>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="students" href="/students" textValue="수강생">
                  <div>
                    <BookUserIcon strokeWidth={1.5} className="size-5" />
                  </div>
                  <div>
                    <Label>수강생</Label>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="payments" href="/payments" textValue="입금내역">
                  <div>
                    <ReceiptIcon strokeWidth={1.5} className="size-5" />
                  </div>
                  <div>
                    <Label>입금내역</Label>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="meetings" href="/meetings" textValue="상담">
                  <div>
                    <UserRoundCheckIcon strokeWidth={1.5} className="size-5" />
                  </div>
                  <div>
                    <Label>상담</Label>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="calendar" href="/calendar" textValue="캘린더">
                  <div>
                    <CalendarIcon strokeWidth={1.5} className="size-5" />
                  </div>
                  <div>
                    <Label>캘린더</Label>
                  </div>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </header>

      {/* 데스크탑 고정 사이드바 */}
      <aside
        className="hidden sm:flex w-72 shrink-0 flex-col rounded-2xl
                   sticky top-4 h-[calc(100dvh-2rem)] self-start
                   bg-white/70 backdrop-blur-xl
                   border border-white/60
                   shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
