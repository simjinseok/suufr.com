'use client';

import * as React from 'react';

type Tab = {
  id: string;
  label: string;
};

type Props = {
  tabs: Tab[];
  general: React.ReactNode;
  members: React.ReactNode;
};

export function SettingsTabs({ tabs, general, members }: Props) {
  const [activeTab, setActiveTab] = React.useState(tabs[0]?.id ?? 'general');

  const slots: Record<string, React.ReactNode> = {
    general,
    members,
  };

  return (
    <>
      <nav className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? 'text-indigo-600 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-900 border-transparent hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div>{slots[activeTab]}</div>
    </>
  );
}
