import * as React from 'react';
import StudentTabs from './_tabs';

export default function Layout({
  children,
  stats,
  comments,
  lessons,
  payments,
}: LayoutProps<'/students/[studentUuid]'>) {
  return (
    <div>
      {children}
      {stats}
      <StudentTabs comments={comments} lessons={lessons} payments={payments} />
    </div>
  );
}
