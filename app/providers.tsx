'use client';
import { HeroUIProvider, ToastProvider } from '@heroui/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider
      locale="ko-KR"
      disableRipple
      labelPlacement="outside"
    >
      {children}
      <ToastProvider />
    </HeroUIProvider>
  );
}
