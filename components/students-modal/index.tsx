'use client';
import * as React from 'react';
import { Button, Modal } from '@heroui/react';
import getUsers from './action';

export default function StudentsModal({ isOpen, onClose }) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container>
        <Content />
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function Content({ title }) {
  const [isPending, startTransition] = React.useTransition();
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    startTransition(async () => {
      const result = await getUsers();
      console.log('???', result);
    });
  }, []);
  return (
    <Modal.Dialog>
      {onClose => (
        <React.Fragment>
          <Modal.Header>{title || '수강생 목록'}</Modal.Header>
          <Modal.Body>
            fd
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onClick={onClose}>닫기</Button>
            <Button variant="primary">선택</Button>
          </Modal.Footer>
        </React.Fragment>
      )}
    </Modal.Dialog>
  );
}
