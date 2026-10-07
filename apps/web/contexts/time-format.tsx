'use client';
import { createContext, useContext } from 'react';
import type { TUserSettings } from '@/types/index';
import { DEFAULT_PAYMENT_METHOD } from '@/constants/payment-method';

const defaultSettings: TUserSettings = {
  userId: '',
  use24HourFormat: false,
  defaultDuration: 50,
  autoUpdateNextPaymentAt: true,
  timezone: null,
  defaultPaymentMethod: DEFAULT_PAYMENT_METHOD,
};

const UserSettingsContext = createContext<TUserSettings>(defaultSettings);

export function TimeFormatProvider({
  children,
  use24HourFormat,
  defaultDuration,
  defaultPaymentMethod,
}: {
  children: React.ReactNode;
  use24HourFormat: TUserSettings['use24HourFormat'];
  defaultDuration: TUserSettings['defaultDuration'];
  defaultPaymentMethod: TUserSettings['defaultPaymentMethod'];
}) {
  return (
    <UserSettingsContext value={{ ...defaultSettings, use24HourFormat, defaultDuration, defaultPaymentMethod }}>
      {children}
    </UserSettingsContext>
  );
}

export function useUserSettings() {
  return useContext(UserSettingsContext);
}

export function useIs24HourFormat() {
  const settings = useUserSettings();
  return settings.use24HourFormat;
}

export function useHourCycle() {
  const use24HourFormat = useIs24HourFormat();
  return use24HourFormat ? 24 : 12;
}

export function useDefaultDuration() {
  const settings = useUserSettings();
  return settings.defaultDuration;
}

// 새 입금 폼의 초기 결제수단 (설정 > 기본 결제수단)
export function useDefaultPaymentMethod() {
  const settings = useUserSettings();
  return settings.defaultPaymentMethod;
}
