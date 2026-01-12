import * as React from 'react';
import StudentTabs from './_tabs';

export default function Layout({
  children,
  timeline,
  lessons,
  payments,
}: {
  children: React.ReactNode;
  timeline: React.ReactNode;
  lessons: React.ReactNode;
  payments: React.ReactNode;
}) {
  return (
    <div>
      {children}
      <StudentTabs timeline={timeline} lessons={lessons} payments={payments} />
    </div>
  );
}
