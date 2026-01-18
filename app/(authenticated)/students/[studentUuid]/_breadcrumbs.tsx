'use client';
import { Breadcrumbs, BreadcrumbItem } from '@heroui/react';
import { UserIcon } from 'lucide-react';

export default function _Breadcrumbs({ studentName }) {
  return (
    <Breadcrumbs className="mb-5">
      <BreadcrumbItem href="/students">
        <UserIcon width={16} height={16} />
      </BreadcrumbItem>
      <BreadcrumbItem className="font-bold">
        {studentName}
      </BreadcrumbItem>
    </Breadcrumbs>
  );
}
