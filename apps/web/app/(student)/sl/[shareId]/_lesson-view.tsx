'use client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

import * as React from 'react';
import { CircleIcon, CircleCheckBigIcon, UserIcon, ImageIcon, Video } from 'lucide-react';
import FilePreviewModal from './_file-preview-modal';

type PreviewFile = {
  url: string;
  type: 'image' | 'video';
  fileName: string | null;
};

interface Props {
  lesson: {
    title: string;
    notes: string;
    student?: {
      name: string;
      nextPaymentAt: Date | null;
    } | null;
    payment?: {
      id: number;
    } | null;
    sessions: Array<{
      id: number;
      notes: string;
      sessionAt: Date;
      isDone: boolean;
      feedback?: {
        id: number;
        notes: string | null;
        feedbackMediaFiles?: Array<{
          id: number;
          mediaFile: {
            id: number;
            uuid: string;
            url: string;
            type: 'image' | 'video';
            fileName: string | null;
            fileSize: number;
            createdAt: string;
          };
        }>;
      } | null;
    }>;
  };
  teacher?: {
    name: string;
    profileImageUrl: string | null;
  } | null;
}

export default function LessonView({ lesson, teacher }: Props) {
  const [previewFile, setPreviewFile] = React.useState<PreviewFile | null>(null);
  const completedCount = lesson.sessions.filter(l => l.isDone).length;
  const totalCount = lesson.sessions.length;

  return (
    <div className="bg-white py-4 border border-gray-100 rounded-xl shadow-sm">
      {/* 레슨 타이틀 & 결제상태 */}
      <div className="px-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{lesson.title}</h2>
        <div className="flex flex-col items-end gap-1">
          {lesson.payment ? (
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
              결제완료
            </span>
          ) : (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              미결제
            </span>
          )}
          {lesson.student?.nextPaymentAt && (
            <span className="text-xs text-gray-500">
              다음결제예정일: {format(lesson.student.nextPaymentAt, 'M월 d일', { locale: ko })}
            </span>
          )}
        </div>
      </div>
      <hr className="my-4 h-px border-none w-full bg-gray-200" />

      {lesson.sessions.length > 0
        ? (
            <div>
              <ul className="px-5 space-y-3">
                {lesson.sessions.map(session => (
                  <li key={session.id} className="flex items-start gap-2">
                    <div className="size-6 flex items-center justify-center flex-shrink-0">
                      {session.isDone
                        ? (
                            <CircleCheckBigIcon
                              width={20}
                              height={20}
                              className="text-green-600"
                            />
                          )
                        : (
                            <CircleIcon
                              width={20}
                              height={20}
                              className="text-amber-500"
                            />
                          )}
                    </div>
                    <div className="flex-1">
                      <p className="tabular-nums font-medium">
                        {format(session.sessionAt, 'yyyy-MM-dd HH:mm', { locale: ko })}
                      </p>
                      {(session.feedback?.notes || (session.feedback?.feedbackMediaFiles && session.feedback.feedbackMediaFiles.length > 0)) && (
                        <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                          <p className="text-xs text-blue-600 font-medium">피드백</p>
                          {session.feedback.notes && (
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {session.feedback.notes}
                            </p>
                          )}
                          {session.feedback.feedbackMediaFiles && session.feedback.feedbackMediaFiles.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {session.feedback.feedbackMediaFiles.map(({ id, mediaFile }) => (
                                <li key={id}>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewFile({
                                      url: mediaFile.url,
                                      type: mediaFile.type,
                                      fileName: mediaFile.fileName,
                                    })}
                                    className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 hover:underline"
                                  >
                                    {mediaFile.type === 'image'
                                      ? <ImageIcon className="size-4 text-gray-400" />
                                      : <Video className="size-4 text-gray-400" />}
                                    <span className="truncate max-w-[200px]">{mediaFile.fileName || '파일'}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <hr className="my-4 h-px border-none w-full bg-gray-200" />
              <div className="px-5 flex items-center gap-4">
                {/* 선생님 프로필 */}
                {teacher && (
                  <div className="flex items-center gap-2 shrink-0">
                    {teacher.profileImageUrl ? (
                      <img
                        src={teacher.profileImageUrl}
                        alt={teacher.name}
                        className="size-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="size-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <UserIcon className="size-4 text-gray-400" />
                      </div>
                    )}
                    <p className="text-sm font-medium text-gray-700">{teacher.name}</p>
                  </div>
                )}
                {/* 진행률 */}
                <div className="flex-1">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>진행률</span>
                    <span>
                      {completedCount}
                      {' '}
                      /
                      {totalCount}
                      {' '}
                      완료
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        : (
            <div className="py-5 text-center text-gray-500">
              설정된 수업이 없습니다
            </div>
          )}

      <FilePreviewModal
        isOpen={!!previewFile}
        onOpenChange={(isOpen: boolean) => { if (!isOpen) setPreviewFile(null); }}
        file={previewFile}
      />
    </div>
  );
}
