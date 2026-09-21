import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCheckoutDto {
  @ApiPropertyOptional({
    description: 'Stripe promotion code (e.g. BETA100, STUDENT50, LAUNCH50)',
    example: 'BETA100',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  promotionCode?: string;
}
