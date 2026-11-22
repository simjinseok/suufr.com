import { Nanum_Pen_Script } from 'next/font/google';
import { H2, WRAP } from './product-ui';

// 이 글꼴이 제공하는 subset 은 'latin' 뿐이라 한글 글리프는 unicode-range 조각으로만 받는다.
// latin 을 미리 받아도 노트 글자에는 쓸모가 없으므로 preload 는 끈다.
const penScript = Nanum_Pen_Script({
  weight: '400',
  display: 'swap',
  preload: false,
  fallback: ['cursive'],
});

// 종이 괘선(44px 간격)과 왼쪽 여백선
const PAPER = {
  background: [
    'linear-gradient(90deg, transparent 43px, #F1B8BC 43px, #F1B8BC 44.5px, transparent 44.5px)',
    'repeating-linear-gradient(#fff, #fff 43px, #C9DAEE 43px, #C9DAEE 44px)',
  ].join(', '),
};

const LINE = 'whitespace-nowrap overflow-hidden';
const SMALL = 'pl-[1.2em] text-[21px] md:text-[24px]';
const RED = 'text-[#C8323C]';

export default function Origin() {
  return (
    <section className="bg-site-band py-16 md:py-24">
      <div className={`${WRAP} grid grid-cols-1 gap-9 items-center md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:gap-16`}>
        <div
          role="img"
          aria-label="수업과 입금이 뒤섞여 적힌 과외 선생님의 노트"
          style={PAPER}
          className={`${penScript.className} relative min-w-0 border border-site-line rounded-[4px] pt-3 pr-[22px] pb-[22px] pl-[54px] md:pl-[60px] -rotate-[1.4deg] text-[24px] md:text-[29px] leading-[44px] text-[#23408E] break-normal`}
        >
          <div aria-hidden="true">
            <div className={LINE}>서연 11월 &nbsp;3 ✓ 5 ✓ 10 ✓ 12 ✓ 17 ✓</div>
            <div className={`${LINE} ${SMALL}`}>
              19 &nbsp;24 &nbsp;26 &nbsp;
              <span className={RED}>← 8회 맞나?</span>
            </div>
            <div className={LINE}>
              입금 32 &nbsp;
              <s className="decoration-2">11/5</s>
              {'  '}
              <span className={`${RED} border-2 border-[#C8323C] rounded-[50%_46%_52%_48%] px-2`}>아직?</span>
            </div>
            <div className={LINE}>
              준호 화목 4회 &nbsp;
              <s className="decoration-2">남은 거 2</s>
              {' '}
              1번
            </div>
            <div className={`${LINE} ${SMALL}`}>
              10월분 받음 ✓ &nbsp;11월분
              {' '}
              <span className={RED}>??</span>
            </div>
            <div className={LINE}>하은 10/28 보강 → 10월 것? 11월 것?</div>
            <div className={`${LINE} ${SMALL}`}>
              <span className={RED}>10월 36 확인하기!!</span>
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <h2 className={H2}>과외 선생님의 노트에서 시작했습니다</h2>
          <p className="mt-4 max-w-[34em]">수업한 날짜, 남은 횟수, 수업료 받은 날이 한 페이지에 뒤섞여 있었습니다.</p>
          <p className="mt-[14px]">
            캘린더 앱으로 옮겨도 일정 하나하나만 보일 뿐, 이번 달에 몇 번 수업했는지와 수업료가 들어왔는지는 다시 노트를 뒤져야 했습니다.
          </p>
          <p className="mt-[14px]">그래서 스프는 수업을 하루씩이 아니라 한 묶음으로 관리합니다.</p>
        </div>
      </div>
    </section>
  );
}
