import { IsIn } from 'class-validator';

import type { UpdateDecisionStatusRequest } from '@shared/api.interface';

export class UpdateDecisionStatusDto implements UpdateDecisionStatusRequest {
  @IsIn(['adopted', 'rejected'])
  status!: 'adopted' | 'rejected';
}
