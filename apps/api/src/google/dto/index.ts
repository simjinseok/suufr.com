export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name?: string;
  picture?: string;
}

export interface GoogleConnectionStatus {
  connected: boolean;
  email?: string;
  lastCalendarSyncAt?: Date | null;
  lastContactsSyncAt?: Date | null;
}

export interface GoogleCalendarEvent {
  id?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  extendedProperties?: {
    private?: {
      suufrSessionUuid?: string;
    };
  };
}

export interface GoogleContact {
  resourceName?: string;
  etag?: string;
  names?: Array<{
    displayName?: string;
    familyName?: string;
    givenName?: string;
  }>;
  phoneNumbers?: Array<{
    value?: string;
    type?: string;
  }>;
  emailAddresses?: Array<{
    value?: string;
    type?: string;
  }>;
  organizations?: Array<{
    name?: string;
    title?: string;
  }>;
  userDefined?: Array<{
    key?: string;
    value?: string;
  }>;
  birthdays?: Array<{
    date?: {
      year?: number; // 0 = 연도 미상
      month?: number; // 1-12
      day?: number; // 1-31
    };
  }>;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: number;
}
