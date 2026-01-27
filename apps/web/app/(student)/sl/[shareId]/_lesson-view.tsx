'use client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

import * as React from 'react';
import { CircleIcon, CircleCheckBigIcon, UserIcon, ImageIcon, Video, FileTextIcon, PaperclipIcon } from 'lucide-react';
import FilePreviewModal from './_file-preview-modal';

type PreviewFile = {
  url: string;
  type: 'image' | 'video';
  fileName: string | null;
};

type MediaFile = {
  uuid: string;
  url: string;
  type: 'image' | 'video' | 'document';
  fileName: string | null;
};

interface Props {
  lesson: {
    title: string;
    notes: string;
    payment?: {
      id: number;
    } | null;
    sessions: Array<{
      uuid: string;
      notes: string;
      sessionAt: Date;
      duration: number;
      isDone: boolean;
      sessionMediaFiles?: Array<{
        mediaFile: MediaFile;
      }>;
      feedback?: {
        notes: string | null;
        feedbackMediaFiles?: Array<{
          mediaFile: MediaFile;
        }>;
      } | null;
    }>;
  };
  teacher?: {
    name: string;
    profileImageUrl: string | null;
  } | null;
}

function getFileIcon(type: 'image' | 'video' | 'document') {
  switch (type) {
    case 'image':
      return <ImageIcon className="size-4 text-gray-400" />;
    case 'video':
      return <Video className="size-4 text-gray-400" />;
    case 'document':
    default:
      return <FileTextIcon className="size-4 text-gray-400" />;
  }
}

export default function LessonView({ lesson, teacher }: Props) {
  const [previewFile, setPreviewFile] = React.useState<PreviewFile | null>(null);

  const handleFileClick = (mediaFile: MediaFile) => {
    if (mediaFile.type === 'document') {
      // document 타입은 새 탭에서 열기
      window.open(mediaFile.url, '_blank');
    } else {
      // image, video는 모달로 미리보기
      setPreviewFile({
        url: mediaFile.url,
        type: mediaFile.type,
        fileName: mediaFile.fileName,
      });
    }
  };

  return (
    <div className="bg-white py-4 border border-gray-100 rounded-xl shadow-xs">
      {/* 레슨 타이틀 */}
      <div className="px-4">
        <h2 className="text-lg font-semibold text-gray-900">{lesson.title}</h2>
      </div>
      <hr className="my-4 h-px border-none w-full bg-gray-200" />

      {lesson.sessions.length > 0
        ? (
            <div>
              <ul className="px-5 space-y-4">
                {lesson.sessions.map(session => (
                  <li key={session.uuid} className="flex items-start gap-2">
                    <div className="size-6 flex items-center justify-center flex-shrink-0 mt-0.5">
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
                      {/* 날짜/시간 표시 */}
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">
                          {format(session.sessionAt, 'M월 d일', { locale: ko })}
                        </p>
                        <span className="text-sm text-gray-500">
                          ({format(session.sessionAt, 'E', { locale: ko })})
                        </span>
                        <span className="text-sm text-gray-600">
                          {format(session.sessionAt, 'HH:mm', { locale: ko })}
                        </span>
                        <span className="text-xs text-gray-400">· {session.duration}분</span>
                      </div>

                      {/* 세션 노트 */}
                      {session.notes && (
                        <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">
                          {session.notes}
                        </p>
                      )}

                      {/* 세션 첨부파일 (수업 자료) */}
                      {session.sessionMediaFiles && session.sessionMediaFiles.length > 0 && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-600 font-medium mb-1 flex items-center gap-1">
                            <PaperclipIcon className="size-3.5" />
                            수업 자료
                          </p>
                          <ul className="space-y-1">
                            {session.sessionMediaFiles.map(({ mediaFile }) => (
                              <li key={mediaFile.uuid}>
                                <button
                                  type="button"
                                  onClick={() => handleFileClick(mediaFile)}
                                  className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 hover:underline"
                                >
                                  {getFileIcon(mediaFile.type)}
                                  <span className="truncate max-w-[200px]">{mediaFile.fileName || '파일'}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 피드백 */}
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
                              {session.feedback.feedbackMediaFiles.map(({ mediaFile }) => (
                                <li key={mediaFile.uuid}>
                                  <button
                                    type="button"
                                    onClick={() => handleFileClick(mediaFile)}
                                    className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 hover:underline"
                                  >
                                    {getFileIcon(mediaFile.type)}
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
              {/* 푸터: 선생님 프로필 + 결제상태 */}
              <div className="px-5 flex items-center justify-between">
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
                {/* 결제 상태 */}
                {lesson.payment ? (
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    결제완료
                  </span>
                ) : (
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                    미결제
                  </span>
                )}
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
