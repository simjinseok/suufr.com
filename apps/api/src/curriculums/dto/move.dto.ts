import { IsIn } from 'class-validator';
import type { MoveDirection } from '../curriculum-order';

export class MoveDto {
  @IsIn(['up', 'down'])
  direction!: MoveDirection;
}
