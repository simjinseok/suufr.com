'use client';

import { ChevronsUpDownIcon, BuildingIcon, CheckIcon } from 'lucide-react';
import { Button, Dropdown, Label } from '@heroui/react';
import type { OrganizationRole } from '@/prisma/generated/client';

type OrganizationItem = {
  id: number;
  uuid: string;
  name: string;
  role: OrganizationRole;
};

type Props = {
  currentOrg: OrganizationItem;
  organizations: OrganizationItem[];
};

export function OrganizationSwitcher({ currentOrg, organizations }: Props) {
  const handleSelect = async (key: string | number) => {
    const selectedOrg = organizations.find(org => org.uuid === key);
    if (selectedOrg && selectedOrg.id !== currentOrg.id) {
      window.location.href = `/api/switch-organization/${selectedOrg.uuid}`;
    }
  };

  return (
    <Dropdown>
      <Button
        variant="ghost"
        className="w-full justify-between px-3 py-2.5 h-auto"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-violet-100 to-indigo-100 flex items-center justify-center shrink-0">
            <BuildingIcon className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {currentOrg.name}
            </p>
          </div>
        </div>
        <ChevronsUpDownIcon className="w-4 h-4 text-gray-400 shrink-0" />
      </Button>
      <Dropdown.Popover placement="bottom start">
        <Dropdown.Menu
          aria-label="조직 선택"
          onAction={handleSelect}
          selectionMode="single"
          selectedKeys={new Set([currentOrg.uuid])}
        >
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
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
