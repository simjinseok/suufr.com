import { TZDate } from '@date-fns/tz';
import type { TodaySession } from '@/utils/api/dashboard';

const DAY_MINUTES = 24 * 60;
// 이 길이(분) 이상인 수업만 블록에 끝 시각까지 쓴다
const LONG_SESSION_MINUTES = 120;

export type TimeBlock = {
  uuid: string;
  name: string;
  studentUuid: string;
  leftPct: number; // 0~24시 기준 %
  widthPct: number;
  state: 'done' | 'next' | 'later';
  timeLabel: string; // 2시간 이상이면 '14:00–16:00', 아니면 '10:00'
  rangeLabel: string; // 툴팁용 '14:00–15:30'
  lane: number; // 겹침 처리
  laneCount: number;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

// 유저 타임존에서 그날 0시부터 흐른 분
function minutesOfDay(date: Date, timezone: string): number {
  const zoned = new TZDate(date, timezone);
  return zoned.getHours() * 60 + zoned.getMinutes() + zoned.getSeconds() / 60;
}

function hm(date: Date, timezone: string): string {
  const zoned = new TZDate(date, timezone);
  return `${pad(zoned.getHours())}:${pad(zoned.getMinutes())}`;
}

export function nowPct(now: Date, timezone: string): number {
  return minutesOfDay(now, timezone) / DAY_MINUTES * 100;
}

export function layoutTimeBar(sessions: TodaySession[], now: Date, timezone: string): TimeBlock[] {
  const sorted = [...sessions].sort((a, b) => Date.parse(a.sessionAt) - Date.parse(b.sessionAt));
  const nowMs = now.getTime();

  // 다음 수업 = 아직 끝나지 않은 첫 미완료 수업
  const nextIndex = sorted.findIndex(s =>
    !s.isDone && Date.parse(s.sessionAt) + s.duration * 60_000 > nowMs);

  const items = sorted.map((s, index) => {
    const startAt = new Date(s.sessionAt);
    const endAt = new Date(startAt.getTime() + s.duration * 60_000);
    const start = minutesOfDay(startAt, timezone);
    // 자정을 넘는 수업은 24시에서 자른다
    const end = Math.min(start + s.duration, DAY_MINUTES);
    const startLabel = hm(startAt, timezone);
    const rangeLabel = `${startLabel}–${hm(endAt, timezone)}`;

    const block: TimeBlock = {
      uuid: s.uuid,
      name: s.student.name,
      studentUuid: s.student.uuid,
      leftPct: start / DAY_MINUTES * 100,
      widthPct: (end - start) / DAY_MINUTES * 100,
      state: s.isDone ? 'done' : index === nextIndex ? 'next' : 'later',
      timeLabel: s.duration >= LONG_SESSION_MINUTES ? rangeLabel : startLabel,
      rangeLabel,
      lane: 0,
      laneCount: 1,
    };
    return { block, start, end };
  });

  // 레인: 시작순 그리디. 서로 이어 겹치는 묶음마다 laneCount를 정한다
  let cluster: typeof items = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];
  const closeCluster = () => {
    for (const item of cluster) item.block.laneCount = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };

  for (const item of items) {
    if (cluster.length > 0 && item.start >= clusterEnd) closeCluster();
    let lane = laneEnds.findIndex(laneEnd => laneEnd <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    }
    else {
      laneEnds[lane] = item.end;
    }
    item.block.lane = lane;
    cluster.push(item);
    clusterEnd = cluster.length === 1 ? item.end : Math.max(clusterEnd, item.end);
  }
  if (cluster.length > 0) closeCluster();

  return items.map(item => item.block);
}
