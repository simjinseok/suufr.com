'use client';

import * as React from 'react';

type ModalEntry = {
  id: string;
  Component: React.ComponentType<any>;
  props: Record<string, any>;
};

// Module-level state
let modals: ModalEntry[] = [];
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(listener => listener());
}

// Public API - Toast 스타일로 어디서든 사용 가능
export const modal = {
  show<P extends Record<string, any>>(
    Component: React.ComponentType<P & { isOpen?: boolean; onOpenChange?: (open: boolean) => void }>,
    props: Omit<P, 'isOpen' | 'onOpenChange'>
  ): string {
    const id = crypto.randomUUID();
    modals = [...modals, { id, Component, props }];
    notifyListeners();
    return id;
  },

  hide(id?: string) {
    if (id) {
      modals = modals.filter(m => m.id !== id);
    } else {
      modals = modals.slice(0, -1);
    }
    notifyListeners();
  },
};

// Provider - 상태 변화를 구독하여 렌더링
export function ModalManagerProvider({ children }: { children: React.ReactNode }) {
  const [currentModals, setCurrentModals] = React.useState<ModalEntry[]>([]);

  React.useEffect(() => {
    const listener = () => setCurrentModals([...modals]);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <>
      {children}
      {currentModals.map(({ id, Component, props }) => (
        <Component
          key={id}
          {...props}
          isOpen={true}
          onOpenChange={(open: boolean) => !open && modal.hide(id)}
        />
      ))}
    </>
  );
}
