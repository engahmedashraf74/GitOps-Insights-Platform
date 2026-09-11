import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username?: string;
}

export class UpdatePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ enum: ['dark', 'system'] })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  defaultProjectId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  deploymentFailures?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  weeklySummary?: boolean;
}
