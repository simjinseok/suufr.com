'use client';
import type { TAppToken } from '@/types/index';

import React from 'react';
import { Button, Modal, Surface } from '@heroui/react';
import { Plus, Trash2 } from 'lucide-react';
import CreateAppTokenModal from './create-app-token-modal';

import { revokeAppToken } from '@/actions/app-token';

interface AppTokensSectionProps {
  tokens: TAppToken[];
  userEmail?: string;
}

export default function AppTokensSection({ tokens, userEmail }: AppTokensSectionProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleRevoke = async (tokenId: number, tokenName: string) => {
    if (!confirm(`"${tokenName}" 토큰을 삭제하시겠습니까?`)) return;

    const result = await revokeAppToken(tokenId);
    if (result.success) {
      alert(result.message);
    }
    else {
      alert(result.message || '토큰 삭제에 실패했습니다.');
    }
  };

  return (
    <Surface className="p-5 border border-gray-50 rounded-xl shadow-xs">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-semibold">앱 토큰</h2>
          <p className="mt-1 text-sm text-gray-500">
            Apple 캘린더나 연락처 앱에서 스프를 동기화하려면 앱 토큰이 필요합니다.
          </p>
        </div>
        <Modal>
          <Button variant="primary" size="sm">
            <Plus className="w-4 h-4 mr-1" />
            토큰 생성
          </Button>
          <CreateAppTokenModal userEmail={userEmail} onCreated={() => setIsOpen(false)} />
        </Modal>
      </div>

      {tokens.length === 0
        ? (
            <div className="py-8 text-center text-gray-400">
              생성된 앱 토큰이 없습니다.
            </div>
          )
        : (
            <div className="divide-y divide-gray-100">
              {tokens.map(token => (
                <div key={token.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{token.name}</p>
                    <p className="text-sm text-gray-500">
                      {token.lastUsedAt
                        ? `마지막 사용: ${formatDate(token.lastUsedAt)}`
                        : '사용한 적 없음'}
                      {' · '}
                      생성일:
                      {' '}
                      {formatDate(token.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    onClick={() => handleRevoke(token.id, token.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
    </Surface>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}
