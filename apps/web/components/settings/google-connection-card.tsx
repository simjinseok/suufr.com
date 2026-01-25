'use client';

import React from 'react';
import { Button, Surface, toast } from '@heroui/react';
import { Calendar, Users, RefreshCw, Unlink, ExternalLink } from 'lucide-react';

import type { GoogleConnectionStatus } from '@/actions/google';
import {
  disconnectGoogle,
  syncGoogleCalendar,
  syncGoogleContacts,
} from '@/actions/google';

interface GoogleConnectionCardProps {
  status: GoogleConnectionStatus;
  authUrl: string | null;
  callbackResult: 'success' | string | null;
}

export default function GoogleConnectionCard({ status, authUrl, callbackResult }: GoogleConnectionCardProps) {
  const [isSyncing, setIsSyncing] = React.useState<'calendar' | 'contacts' | null>(null);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);

  React.useEffect(() => {
    if (!callbackResult) return;

    if (callbackResult === 'success') {
      toast.success('연동 완료', {
        description: 'Google 계정이 연결되었습니다.',
      });
    }
    else {
      toast.danger('연동 실패', {
        description: callbackResult,
      });
    }

    // URL에서 쿼리 파라미터 제거
    window.history.replaceState({}, '', window.location.pathname);
  }, [callbackResult]);

  const handleConnect = () => {

    if (authUrl) {
      window.location.href = authUrl;
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Google 계정 연결을 해제하시겠습니까?\n동기화된 데이터는 Google에서 삭제되지 않습니다.')) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const result = await disconnectGoogle();
      if (result.success) {
        alert(result.message);
        window.location.reload();
      }
      else {
        alert(result.message || '연결 해제에 실패했습니다.');
      }
    }
    finally {
      setIsDisconnecting(false);
    }
  };

  const handleSyncCalendar = async () => {
    setIsSyncing('calendar');
    try {
      const result = await syncGoogleCalendar();
      if (result.success) {
        alert(`캘린더 동기화 완료\n생성: ${result.result?.created ?? 0}, 수정: ${result.result?.updated ?? 0}, 삭제: ${result.result?.deleted ?? 0}`);
        window.location.reload();
      }
      else {
        alert(result.message || '동기화에 실패했습니다.');
      }
    }
    finally {
      setIsSyncing(null);
    }
  };

  const handleSyncContacts = async () => {
    setIsSyncing('contacts');
    try {
      const result = await syncGoogleContacts();
      if (result.success) {
        alert(`연락처 동기화 완료\n생성: ${result.result?.created ?? 0}, 수정: ${result.result?.updated ?? 0}, 삭제: ${result.result?.deleted ?? 0}`);
        window.location.reload();
      }
      else {
        alert(result.message || '동기화에 실패했습니다.');
      }
    }
    finally {
      setIsSyncing(null);
    }
  };

  return (
    <Surface className="p-5 border border-gray-50 rounded-xl shadow-xs">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-white rounded-lg border border-gray-100">
          <svg className="w-8 h-8" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        </div>

        <div className="flex-1">
          <h2 className="text-lg font-semibold">Google 연동</h2>
          <p className="mt-1 text-sm text-gray-500">
            Google Calendar와 Contacts에 수업 일정과 학생 정보를 동기화합니다.
          </p>

          {status.connected
            ? (
                <div className="mt-4">
                  <div className="flex items-center gap-2 text-sm text-green-600 mb-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span>
                      연결됨:
                      {' '}
                      {status.email}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        캘린더
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {status.lastCalendarSyncAt
                          ? `마지막 동기화: ${formatDateTime(new Date(status.lastCalendarSyncAt))}`
                          : '동기화 한 적 없음'}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={handleSyncCalendar}
                        disabled={isSyncing !== null}
                      >
                        {isSyncing === 'calendar'
                          ? (
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            )
                          : (
                              <RefreshCw className="w-3 h-3 mr-1" />
                            )}
                        동기화
                      </Button>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Users className="w-4 h-4 text-gray-500" />
                        연락처
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {status.lastContactsSyncAt
                          ? `마지막 동기화: ${formatDateTime(new Date(status.lastContactsSyncAt))}`
                          : '동기화 한 적 없음'}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={handleSyncContacts}
                        disabled={isSyncing !== null}
                      >
                        {isSyncing === 'contacts'
                          ? (
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            )
                          : (
                              <RefreshCw className="w-3 h-3 mr-1" />
                            )}
                        동기화
                      </Button>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                  >
                    <Unlink className="w-4 h-4 mr-1" />
                    연결 해제
                  </Button>
                </div>
              )
            : (
                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={handleConnect} disabled={!authUrl}>
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Google 계정 연결
                  </Button>
                </div>
              )}
        </div>
      </div>
    </Surface>
  );
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
