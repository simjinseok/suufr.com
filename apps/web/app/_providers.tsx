'use client';

import { I18nProvider, RouterProvider, Toast } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { ModalManagerProvider } from '@/contexts/modal-manager';

export default function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <I18nProvider locale="ko-KR">
      <RouterProvider navigate={router.push}>
        <ModalManagerProvider>
          {children}
        </ModalManagerProvider>
        <Toast.Container placement="top end" />
      </RouterProvider>
    </I18nProvider>
  );
}
