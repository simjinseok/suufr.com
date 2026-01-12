'use client';

import { Spinner } from '@heroui/react';

export default function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      <Spinner />
    </div>
  );
}
