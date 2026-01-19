'use client';

import * as React from 'react';
import {
  Button,
  Avatar,
} from '@heroui/react';
import { TrashIcon, LinkIcon, CrownIcon, HistoryIcon, RefreshCwIcon, PlusIcon, PencilIcon } from 'lucide-react';
import { deleteMember } from '@/actions/member';
import MemberStatusBadge from '@/components/member-status-badge';
import ChangeStatusModal from './_change-status-modal';
import StatusHistoryModal from './_status-history-modal';
import AddMemberModal from './_add-member-modal';
import EditMemberModal from './_edit-member-modal';
import type { MemberStatusValue } from '@/prisma/generated/client';

type Member = {
  id: number;
  uuid: string;
  name: string;
  role: string;
  status: MemberStatusValue;
  profileImageUrl?: string | null;
  userId: string | null;
  isLinked: boolean;
  isSelf: boolean;
};

type Props = {
  organizationUuid: string;
  initialMembers: Member[];
};

export function MembersContent({ organizationUuid, initialMembers }: Props) {
  const [members, setMembers] = React.useState(initialMembers);
  const [statusModalMember, setStatusModalMember] = React.useState<Member | null>(null);
  const [historyModalMember, setHistoryModalMember] = React.useState<Member | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [editModalMember, setEditModalMember] = React.useState<Member | null>(null);

  const handleStatusChange = (memberUuid: string, newStatus: MemberStatusValue) => {
    setMembers(prev =>
      prev.map(m =>
        m.uuid === memberUuid ? { ...m, status: newStatus } : m,
      ),
    );
  };

  const handleMemberAdded = () => {
    // Refresh happens via revalidatePath, but we could also fetch here
    window.location.reload();
  };

  const handleMemberUpdated = (memberUuid: string, updatedData: Partial<Member>) => {
    setMembers(prev =>
      prev.map(m =>
        m.uuid === memberUuid ? { ...m, ...updatedData } : m,
      ),
    );
  };

  const handleDeleteMember = async (memberUuid: string) => {
    if (!confirm('정말 이 멤버를 삭제하시겠습니까?')) return;

    const result = await deleteMember(organizationUuid, memberUuid);
    if (result.success) {
      setMembers(prev => prev.filter(m => m.uuid !== memberUuid));
    }
    else {
      alert(result.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* 멤버 추가 버튼 */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onPress={() => setIsAddModalOpen(true)}
        >
          <PlusIcon className="w-4 h-4 mr-1" />
          멤버 추가
        </Button>
      </div>

      {/* 멤버 목록 */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-4">
          멤버 목록 ({members.length})
        </h3>
        <div className="space-y-2">
          {members.map(member => (
            <div
              key={member.uuid}
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200"
            >
              <Avatar size="md">
                {member.profileImageUrl
                  ? <Avatar.Image src={member.profileImageUrl} alt={member.name} />
                  : null}
                <Avatar.Fallback>{member.name.charAt(member.name.length - 1)}</Avatar.Fallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {member.name}
                  </p>
                  {member.isLinked && (
                    <LinkIcon className="w-3.5 h-3.5 text-green-500" />
                  )}
                  {member.isSelf && (
                    <span className="text-xs text-gray-500">(나)</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <MemberStatusBadge status={member.status} size="sm" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md text-xs font-medium">
                  {member.role === 'owner' && <CrownIcon className="w-3 h-3" />}
                  {member.role === 'owner' ? '소유자' : '선생님'}
                </div>

                <Button
                  variant="ghost"
                  isIconOnly
                  size="sm"
                  onPress={() => setEditModalMember(member)}
                  aria-label="멤버 편집"
                >
                  <PencilIcon className="w-4 h-4 text-gray-400 hover:text-blue-500" />
                </Button>

                {!member.isSelf && (
                  <>
                    <Button
                      variant="ghost"
                      isIconOnly
                      size="sm"
                      onPress={() => setStatusModalMember(member)}
                      aria-label="상태 변경"
                    >
                      <RefreshCwIcon className="w-4 h-4 text-gray-400 hover:text-blue-500" />
                    </Button>

                    <Button
                      variant="ghost"
                      isIconOnly
                      size="sm"
                      onPress={() => setHistoryModalMember(member)}
                      aria-label="상태 변경 이력"
                    >
                      <HistoryIcon className="w-4 h-4 text-gray-400 hover:text-blue-500" />
                    </Button>

                    <Button
                      variant="ghost"
                      isIconOnly
                      size="sm"
                      onPress={() => handleDeleteMember(member.uuid)}
                    >
                      <TrashIcon className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}

          {members.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">
              멤버가 없습니다
            </p>
          )}
        </div>
      </div>

      {/* 멤버 추가 모달 */}
      <AddMemberModal
        isOpen={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        organizationUuid={organizationUuid}
        onMemberAdded={handleMemberAdded}
      />

      {/* 멤버 편집 모달 */}
      {editModalMember && (
        <EditMemberModal
          isOpen={editModalMember !== null}
          onOpenChange={open => !open && setEditModalMember(null)}
          organizationUuid={organizationUuid}
          member={editModalMember}
          onMemberUpdated={updatedData => handleMemberUpdated(editModalMember.uuid, updatedData)}
        />
      )}

      {/* 상태 변경 모달 */}
      {statusModalMember && (
        <ChangeStatusModal
          isOpen={statusModalMember !== null}
          onOpenChange={open => !open && setStatusModalMember(null)}
          organizationUuid={organizationUuid}
          member={statusModalMember}
          onStatusChange={newStatus => handleStatusChange(statusModalMember.uuid, newStatus)}
        />
      )}

      {/* 상태 이력 모달 */}
      {historyModalMember && (
        <StatusHistoryModal
          isOpen={historyModalMember !== null}
          onOpenChange={open => !open && setHistoryModalMember(null)}
          organizationUuid={organizationUuid}
          member={historyModalMember}
        />
      )}
    </div>
  );
}
