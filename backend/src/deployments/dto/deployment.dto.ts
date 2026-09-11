import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateEnvironmentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  applicationId: number;
}

export class CreateDeploymentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  revision: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  status: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  environment: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  applicationId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  syncStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  healthStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  commitSha?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  environmentId?: number;
}

export class UpdateDeploymentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  syncStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  healthStatus?: string;
}

export class ListDeploymentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  applicationId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  environment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string;
}
