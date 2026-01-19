'use client';
import { createContext, useContext } from 'react';
import type { TUserSettings } from '@/types/index';

const defaultSettings: TUserSettings = {
  userId: '',
  use24HourFormat: false,
  defaultDuration: 50,
  autoUpdateNextPaymentAt: true,
};

const UserSettingsContext = createContext<TUserSettings>(defaultSettings);

export function TimeFormatProvider({
  children,
  use24HourFormat,
  defaultDuration,
}: {
  children: React.ReactNode;
  use24HourFormat: TUserSettings['use24HourFormat'];
  defaultDuration: TUserSettings['defaultDuration'];
}) {
  return (
    <UserSettingsContext value={{ ...defaultSettings, use24HourFormat, defaultDuration }}>
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
