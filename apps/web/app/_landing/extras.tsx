import { H2, WRAP } from './product-ui';

const ITEMS = [
  {
    title: '상담 기록',
    body: '문의가 온 날과 나눈 이야기를 남겨 두고, 다시 연락할 사람을 놓치지 않습니다.',
  },
  {
    title: '수업 자료 보관',
    body: '악보, 프린트, 사진을 수업에 붙여 둡니다.',
  },
  {
    title: '수강생에게 보내는 링크',
    body: '수업 기록과 피드백을 링크 하나로 보여 줍니다. 수강생은 가입하지 않아도 됩니다.',
  },
];

export default function Extras() {
  return (
    <section className="bg-site-band py-16 md:py-24">
      <div className={WRAP}>
        <h2 className={H2}>필요할 때 꺼내 쓰는 기능</h2>
        <div className="mt-9 grid grid-cols-[minmax(0,1fr)] md:grid-cols-[repeat(3,minmax(0,1fr))] border-t border-site-line">
          {ITEMS.map((item, i) => (
            <div
              key={item.title}
              className={`min-w-0 py-5 md:pt-[22px] md:pb-0 md:pr-6 ${
                i > 0 ? 'border-t border-site-line md:border-t-0 md:border-l md:pl-6' : ''
              }`}
            >
              <h3 className="text-[18px] font-bold text-brand-navy">{item.title}</h3>
              <p className="mt-1.5 text-[16px]">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
