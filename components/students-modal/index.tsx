'use client';
import * as React from 'react';
import {Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader} from '@heroui/react';
import getUsers from './action';

export default function StudentsModal({isOpen, onClose}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <Content/>
    </Modal>
  )
}

function Content({ title }) {
  const [isPending, startTransition] = React.useTransition();
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    startTransition(async () => {
      const result = await getUsers();
      console.log('???', result);
    })
  }, []);
  return (
    <ModalContent>
      {onClose => (
        <React.Fragment>
          <ModalHeader>{title || '수강생 목록'}</ModalHeader>
          <ModalBody>
            fd
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>닫기</Button>
            <Button color="primary">선택</Button>
          </ModalFooter>
        </React.Fragment>
      )}
    </ModalContent>
  );
}
