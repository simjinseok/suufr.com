'use client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { tz } from '@date-fns/tz';
import { useTimeZone } from '@/contexts/timezone';

import { CircleIcon, CircleCheckBigIcon, UserIcon, ImageIcon, Video, FileTextIcon } from 'lucide-react';

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
      sessionAt: Date | string;
      duration: number;
      isDone: boolean;
      sessionMediaFiles?: Array<{
        mediaFile: MediaFile;
      }>;
      feedback?: {
        notes: string | null;
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
  const timeZone = useTimeZone();
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
                          {format(new Date(session.sessionAt), 'M월 d일', { locale: ko, in: tz(timeZone) })}
                        </p>
                        <span className="text-sm text-gray-500">
                          ({format(new Date(session.sessionAt), 'E', { locale: ko, in: tz(timeZone) })})
                        </span>
                        <span className="text-sm text-gray-600">
                          {format(new Date(session.sessionAt), 'HH:mm', { locale: ko, in: tz(timeZone) })}
                        </span>
                        <span className="text-xs text-gray-400">· {session.duration}분</span>
                      </div>

                      {/* 세션 노트 */}
                      {session.notes && (
                        <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">
                          {session.notes}
                        </p>
                      )}

                      {/* 피드백 */}
                      {session.feedback?.notes && (
                        <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                          <p className="text-xs text-blue-600 font-medium">피드백</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {session.feedback.notes}
                          </p>
                        </div>
                      )}

                      {/* 첨부파일 */}
                      {session.sessionMediaFiles && session.sessionMediaFiles.length > 0 && (
                        <div className="mt-2 flex flex-col gap-1">
                          {session.sessionMediaFiles.map(({ mediaFile }) => (
                            <a
                              key={mediaFile.uuid}
                              href={mediaFile.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            >
                              {getFileIcon(mediaFile.type)}
                              <span className="truncate max-w-[200px]">{mediaFile.fileName || '파일'}</span>
                            </a>
                          ))}
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
    </div>
  );
}
