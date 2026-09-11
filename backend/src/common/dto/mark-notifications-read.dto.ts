import { IsArray, IsInt, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class MarkNotificationsReadDto {
  @ApiPropertyOptional({ type: [Number], description: 'Notification ids. Omit to mark all as read.' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  ids?: number[];
}
