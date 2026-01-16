'use client';
import { createContext, useContext } from 'react';
import type { TUserSettings } from '@/types/index';

const defaultSettings: TUserSettings = {
  userId: '',
  timeFormat: '24h',
  defaultDuration: 50,
};

const UserSettingsContext = createContext<TUserSettings>(defaultSettings);

export function TimeFormatProvider({
  children,
  timeFormat,
  defaultDuration,
}: {
  children: React.ReactNode;
  timeFormat: TUserSettings['timeFormat'];
  defaultDuration: TUserSettings['defaultDuration'];
}) {
  return (
    <UserSettingsContext value={{ ...defaultSettings, timeFormat, defaultDuration }}>
      {children}
    </UserSettingsContext>
  );
}

export function useUserSettings() {
  return useContext(UserSettingsContext);
}

export function useTimeFormat() {
  const settings = useUserSettings();
  return settings.timeFormat;
}

export function useHourCycle() {
  const timeFormat = useTimeFormat();
  return timeFormat === '12h' ? 12 : 24;
}

export function useDefaultDuration() {
  const settings = useUserSettings();
  return settings.defaultDuration;
}
