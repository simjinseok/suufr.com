import { FOCUS, H2, WRAP } from './product-ui';

const QUESTIONS = [
  {
    q: '수업료를 스프가 대신 받아 주나요?',
    a: '아니요. 수업료는 지금처럼 계좌로 직접 받으시고, 스프에는 받았다는 사실만 기록합니다. 수강생에게 독촉 문자를 보내지도 않습니다.',
  },
  {
    q: '수강생도 가입해야 하나요?',
    a: '아니요. 스프는 선생님만 씁니다. 수강생에게 수업 기록을 보여 주고 싶을 때는 링크를 보내면 됩니다.',
  },
  {
    q: '휴대폰에서도 쓸 수 있나요?',
    a: '네. 앱을 설치하지 않아도 휴대폰 브라우저에서 바로 열립니다.',
  },
  {
    q: '학원에서도 쓸 수 있나요?',
    a: '스프는 혼자 가르치는 선생님에게 맞춰져 있습니다. 강사 여러 명이 함께 쓰는 기능은 없습니다.',
  },
  {
    q: '횟수 없이 한 달 단위로만 받는 수업도 되나요?',
    a: '네. 수강권을 만들 때 횟수를 비워 두면 기간과 금액만으로 관리합니다.',
  },
];

export default function Faq() {
  return (
    <section className="bg-site-band py-16 md:py-24">
      <div className={`${WRAP} grid grid-cols-[minmax(0,1fr)] gap-9 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] md:gap-14`}>
        <h2 className={H2}>자주 묻는 질문</h2>
        <div className="min-w-0">
          {QUESTIONS.map((item, i) => (
            <details key={item.q} open={i === 0} className="group border-t border-site-line last:border-b">
              <summary className={`relative cursor-pointer list-none py-5 pr-9 text-[18px] font-semibold text-brand-navy [&::-webkit-details-marker]:hidden ${FOCUS} focus-visible:rounded-md`}>
                {item.q}
                <span aria-hidden="true" className="absolute right-1 top-4 text-[24px] font-normal leading-[1.65] text-site-muted">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">−</span>
                </span>
              </summary>
              <p className="pr-9 pb-[22px]">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
