'use client';

import React from 'react';
import { Button } from '@heroui/react';
import CreateSyllabusModal from '@/components/syllabus/create-syllabus-modal';

export default function Header() {
  const [showCreationModal, setShowCreationModal] = React.useState(false);

  return (
    <div className="flex justify-between">
      <h2 className="text-xl font-bold text-default-900 lg:text-3xl">레슨</h2>
      <div>
        <Button variant="primary" onClick={setShowCreationModal.bind(null, true)}>
          레슨 추가
        </Button>
      </div>
      {showCreationModal && (
        <CreateSyllabusModal
          isOpen={showCreationModal}
          onOpenChange={setShowCreationModal}
        />
      )}
    </div>
  );
}
