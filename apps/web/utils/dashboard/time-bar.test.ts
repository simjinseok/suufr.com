import { describe, expect, it } from 'vitest';
import type { TodaySession } from '@/utils/api/dashboard';
import { layoutTimeBar, nowPct } from './time-bar';

const SEOUL = 'Asia/Seoul';
// KST 2026-11-22 13:20
const NOW = new Date('2026-11-22T04:20:00Z');

let seq = 0;
// KST 시각(HH:mm)으로 오늘 수업을 만든다
function session(hhmm: string, duration: number, isDone = false, name = `학생${seq}`): TodaySession {
  seq += 1;
  const [h, m] = hhmm.split(':').map(Number);
  const sessionAt = new Date(Date.UTC(2026, 10, 22, h - 9, m)).toISOString();
  return {
    uuid: `s${seq}`,
    sessionAt,
    duration,
    isDone,
    student: { uuid: `st-${name}`, name },
  };
}

describe('layoutTimeBar', () => {
  it('isDone이면 done, 아직 안 끝난 첫 미완료가 next, 나머지 later', () => {
    const blocks = layoutTimeBar([
      session('10:00', 90, true),
      session('14:00', 120),
      session('16:30', 90),
    ], NOW, SEOUL);
    expect(blocks.map(b => b.state)).toEqual(['done', 'next', 'later']);
  });

  it('끝난 시간이 지났지만 완료 처리 안 된 수업은 later', () => {
    const blocks = layoutTimeBar([
      session('09:00', 60),
      session('14:00', 60),
    ], NOW, SEOUL);
    expect(blocks.map(b => b.state)).toEqual(['later', 'next']);
  });

  it('입력 순서와 관계없이 시작 시각 순으로 판단한다', () => {
    const blocks = layoutTimeBar([
      session('16:30', 90),
      session('14:00', 60),
    ], NOW, SEOUL);
    expect(blocks.map(b => b.timeLabel)).toEqual(['14:00', '16:30']);
    expect(blocks.map(b => b.state)).toEqual(['next', 'later']);
  });

  it('위치는 0~24시 비율', () => {
    const [block] = layoutTimeBar([session('10:00', 90)], NOW, SEOUL);
    expect(block.leftPct).toBeCloseTo(41.667, 3);
    expect(block.widthPct).toBeCloseTo(6.25, 6);
  });

  it('자정을 넘는 수업은 24시에서 자른다', () => {
    const [block] = layoutTimeBar([session('23:30', 90)], NOW, SEOUL);
    expect(block.leftPct + block.widthPct).toBeCloseTo(100, 6);
  });

  it('2시간 이상만 끝 시각을 쓴다', () => {
    const blocks = layoutTimeBar([
      session('14:00', 120),
      session('16:30', 90),
    ], NOW, SEOUL);
    expect(blocks.map(b => b.timeLabel)).toEqual(['14:00–16:00', '16:30']);
  });

  it('툴팁용 범위는 길이와 관계없이 시작–끝', () => {
    const [block] = layoutTimeBar([session('16:30', 90)], NOW, SEOUL);
    expect(block.rangeLabel).toBe('16:30–18:00');
  });

  it('겹치는 수업은 레인을 나눈다', () => {
    const blocks = layoutTimeBar([
      session('14:00', 120),
      session('15:00', 60),
      session('18:00', 60),
    ], NOW, SEOUL);
    expect(blocks.map(b => [b.lane, b.laneCount])).toEqual([[0, 2], [1, 2], [0, 1]]);
  });

  it('끝과 시작이 맞닿기만 하면 겹치지 않는다', () => {
    const blocks = layoutTimeBar([
      session('14:00', 60),
      session('15:00', 60),
    ], NOW, SEOUL);
    expect(blocks.map(b => [b.lane, b.laneCount])).toEqual([[0, 1], [0, 1]]);
  });

  it('학생 정보를 블록에 싣는다', () => {
    const [block] = layoutTimeBar([session('10:00', 60, false, '한지우')], NOW, SEOUL);
    expect(block.name).toBe('한지우');
    expect(block.studentUuid).toBe('st-한지우');
  });
});

describe('nowPct', () => {
  it('유저 타임존의 지금 시각 비율', () => {
    expect(nowPct(NOW, SEOUL)).toBeCloseTo((13 * 60 + 20) / 1440 * 100, 6);
    expect(nowPct(NOW, 'UTC')).toBeCloseTo((4 * 60 + 20) / 1440 * 100, 6);
  });
});
