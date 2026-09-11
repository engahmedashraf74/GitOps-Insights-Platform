import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const TIME_RANGES = ['7d', '30d', '90d'] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

export class TimeRangeQueryDto {
  @ApiPropertyOptional({ enum: TIME_RANGES, default: '30d' })
  @IsOptional()
  @IsIn(TIME_RANGES)
  range?: TimeRange = '30d';
}

export function rangeToDays(range: TimeRange | undefined): number {
  if (range === '7d') return 7;
  if (range === '90d') return 90;
  return 30;
}
