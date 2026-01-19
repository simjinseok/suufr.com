import * as React from 'react';
import StudentTabs from './_tabs';

export default function Layout({
  children,
  comments,
  lessons,
  payments,
}: LayoutProps<'/students/[studentUuid]'>) {
  return (
    <div>
      {children}
      <StudentTabs comments={comments} lessons={lessons} payments={payments} />
    </div>
  );
}
