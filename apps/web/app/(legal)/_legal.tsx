/** 약관/정책 페이지 공용 타이포그래피 컴포넌트 */

export function LegalTitle({ children, effectiveDate }: { children: React.ReactNode; effectiveDate: string }) {
  return (
    <header className="mb-10">
      <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{children}</h1>
      <p className="mt-3 text-sm text-gray-400">
        시행일:
        {' '}
        {effectiveDate}
      </p>
    </header>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-gray-600">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[560px] text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-900">
            {headers.map(header => (
              <th key={header} scope="col" className="py-2 pr-4 font-semibold align-bottom">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-gray-100 align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="py-2.5 pr-4 leading-relaxed">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
