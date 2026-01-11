import { Chip } from '@heroui/react';

export default function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <Chip variant="soft" color="success">수강중</Chip>
    );
  }

  if (status === 'pending') {
    return (
      <Chip variant="soft" color="accent">
        대기중
      </Chip>
    );
  }

  if (status === 'paused') {
    return (
      <Chip variant="soft" color="warning">일시정지</Chip>
    );
  }

  return (
    <Chip variant="soft" color="danger">
      그만둠
    </Chip>
  );
}
