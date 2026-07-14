'use client';
import * as React from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { tz } from '@date-fns/tz';
import { Button, Modal, Spinner } from '@heroui/react';
import { CheckCircle, Circle, MessageSquare } from 'lucide-react';
import { getSessionDetail } from '@/actions/session';
import { useTimeZone } from '@/contexts/timezone';

type SessionData = {
  id: number;
  uuid: string;
  sessionAt: string;
  isDone: boolean;
  notes: string;
  feedback: string | null;
};

type ModalData = {
  current: SessionData & {
    invoiceTitle: string | null;
    studentName: string;
  };
  previousSessions: SessionData[];
};

interface Props {
  sessionUuid: string | null;
  onClose: () => void;
}

export default function SessionDetailModal({ sessionUuid, onClose }: Props) {
  const [data, setData] = React.useState<ModalData | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!sessionUuid) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    getSessionDetail(sessionUuid)
      .then(result => {
        if (!result) throw new Error('Failed to fetch');
        setData(result);
      })
      .catch(() => setError('데이터를 불러오지 못했습니다'))
      .finally(() => setIsLoading(false));
  }, [sessionUuid]);

  const isOpen = sessionUuid !== null;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog className="max-w-md">
          {({ close }) => (
            <Content
              data={data}
              isLoading={isLoading}
              error={error}
              close={close}
            />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  data: ModalData | null;
  isLoading: boolean;
  error: string | null;
  close: () => void;
}

function Content({ data, isLoading, error, close }: ContentProps) {
  const TIMEZONE = useTimeZone();
  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>수업 상세</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-500">{error}</div>
        ) : data ? (
          <div className="space-y-6">
            {/* Current Session */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-bold">{data.current.studentName}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  data.current.isDone
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {data.current.isDone ? '완료' : '예정'}
                </span>
              </div>
              <p className="text-sm text-zinc-500 mb-2">
                {format(new Date(data.current.sessionAt), 'yyyy년 M월 d일 (E) HH:mm', {
                  locale: ko,
                  in: tz(TIMEZONE),
                })}
              </p>
              <p className="text-sm text-zinc-600">{data.current.invoiceTitle}</p>
              {data.current.notes && (
                <div className="mt-3 p-3 bg-zinc-50 rounded-lg">
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap">{data.current.notes}</p>
                </div>
              )}
              {data.current.feedback && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-1 mb-1">
                    <MessageSquare className="w-3 h-3 text-blue-600" />
                    <span className="text-xs font-medium text-blue-700">피드백</span>
                  </div>
                  <p className="text-sm text-blue-800 whitespace-pre-wrap">{data.current.feedback}</p>
                </div>
              )}
            </div>

            {/* Previous Sessions */}
            {data.previousSessions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-zinc-500 mb-3">이전 수업 기록</h4>
                <div className="space-y-3">
                  {data.previousSessions.map(session => (
                    <div key={session.id} className="p-3 border border-zinc-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        {session.isDone
                          ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                          : <Circle className="w-4 h-4 text-amber-500" />
                        }
                        <span className="text-sm font-medium">
                          {format(new Date(session.sessionAt), 'M월 d일 (E) HH:mm', {
                            locale: ko,
                            in: tz(TIMEZONE),
                          })}
                        </span>
                      </div>
                      {session.notes && (
                        <p className="text-xs text-zinc-600 mt-1 whitespace-pre-wrap line-clamp-2">
                          {session.notes}
                        </p>
                      )}
                      {session.feedback && (
                        <p className="text-xs text-blue-600 mt-1 whitespace-pre-wrap line-clamp-2">
                          피드백: {session.feedback}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.previousSessions.length === 0 && (
              <p className="text-sm text-zinc-400 text-center py-2">
                이전 수업 기록이 없습니다
              </p>
            )}
          </div>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onPress={close}>닫기</Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
