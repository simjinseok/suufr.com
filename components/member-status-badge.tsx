import type { ChipProps } from '@heroui/react';
import { Chip } from '@heroui/react';

interface Props extends Pick<ChipProps, 'size' | 'variant'> {
  status: 'active' | 'paused' | 'leave';
}

export default function MemberStatusBadge(props: Props) {
  const { status, variant = 'soft', size = 'md' } = props;

  if (status === 'active') {
    return (
      <Chip variant={variant} size={size} color="success">활동중</Chip>
    );
  }

  if (status === 'paused') {
    return (
      <Chip variant={variant} size={size} color="warning">일시정지</Chip>
    );
  }

  return (
    <Chip variant={variant} size={size} color="danger">탈퇴</Chip>
  );
}
