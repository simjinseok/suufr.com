'use client';

import { LogOutIcon, SettingsIcon, ShieldIcon, BuildingIcon, CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { Avatar, Button, Dropdown, Label, Separator } from '@heroui/react';

type OrganizationItem = {
  id: number;
  uuid: string;
  name: string;
  profileName: string | null;
  profileImageUrl: string | null;
};

type Props = {
  currentOrg: OrganizationItem;
  organizations: OrganizationItem[];
};

export function UserMenu({ currentOrg, organizations }: Props) {
  const profileName = currentOrg.profileName ?? currentOrg.name;
  const profileImageUrl = currentOrg.profileImageUrl;
  const profileInitial = profileName.charAt(profileName.length - 1);

  const handleAction = (key: string | number) => {
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

  return (
    <div className="px-3 pb-4 mt-auto">
      <Dropdown>
        <Button
          variant="ghost"
          className="w-full justify-between px-3 py-2.5 h-auto"
        >
          <div className="flex items-center gap-3">
            <Avatar size="sm">
              {profileImageUrl ? (
                <Avatar.Image src={profileImageUrl} alt={profileName} />
              ) : null}
              <Avatar.Fallback>{profileInitial}</Avatar.Fallback>
            </Avatar>
            <div className="text-left min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {profileName}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {currentOrg.name}
              </p>
            </div>
          </div>
          <ChevronsUpDownIcon className="w-4 h-4 text-gray-400 shrink-0" />
        </Button>
        <Dropdown.Popover placement="top start" className="min-w-40">
          <Dropdown.Menu
            aria-label="사용자 메뉴"
            onAction={handleAction}
          >
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
            <Dropdown.Item
              id="org-settings"
              textValue="학원 설정"
            >
              <div>
                <BuildingIcon strokeWidth={1.5} className="size-5" />
              </div>
              <div>
                <Label>학원 설정</Label>
              </div>
            </Dropdown.Item>
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
    </div>
  );
}
