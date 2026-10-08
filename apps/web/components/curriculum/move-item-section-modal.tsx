'use client';
import React from 'react';
import { Form, Modal, Button, type ModalProps } from '@heroui/react';
import { moveCurriculumItemToSection } from '@/actions/curriculum';
import SectionSelect from '@/components/curriculum/section-select';
import type { TCurriculumItem, TCurriculumSection } from '@/types/index';

interface Props {
  isOpen?: ModalProps['isOpen'];
  onOpenChange?: ModalProps['onOpenChange'];
  item: Pick<TCurriculumItem, 'uuid' | 'title' | 'sectionUuid'>;
  sections: Pick<TCurriculumSection, 'uuid' | 'title'>[];
  curriculumUuid: string;
}

/** 항목을 다른 섹션(또는 섹션 없음)으로 옮기는 작은 모달. modal.show 로 띄우는 제어형. */
export default function MoveItemSectionModal({ isOpen, onOpenChange, item, sections, curriculumUuid }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="min-w-[320px]">
          {({ close }) => <Content item={item} sections={sections} curriculumUuid={curriculumUuid} close={close} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function Content({ item, sections, curriculumUuid, close }: Omit<Props, 'isOpen' | 'onOpenChange'> & { close: () => void }) {
  const formId = React.useId();
  const [state, formAction, isPending] = React.useActionState(moveCurriculumItemToSection, {
    fields: { sectionUuid: item.sectionUuid ?? '' },
  });

  React.useEffect(() => {
    if (!state.timestamp) return;
    if (state.success) {
      alert(state.message);
      close();
    }
  }, [state.timestamp, state.success]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>다른 섹션으로 이동</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <p className="text-sm text-zinc-500 mb-3 truncate">{item.title}</p>
        <Form id={formId} className="p-1" action={formAction}>
          <input type="hidden" name="itemUuid" value={item.uuid} />
          <input type="hidden" name="curriculumUuid" value={curriculumUuid} />
          <SectionSelect sections={sections} defaultValue={state.fields?.sectionUuid ?? ''} isDisabled={isPending} />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" isDisabled={isPending} onClick={close}>닫기</Button>
        <Button form={formId} variant="primary" type="submit" isPending={isPending}>이동</Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
