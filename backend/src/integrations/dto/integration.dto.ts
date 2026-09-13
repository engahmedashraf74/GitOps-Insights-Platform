import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConnectArgoCdDto {
  @ApiProperty({ example: 'https://argocd-server.argocd.svc' })
  @IsString()
  @MinLength(8)
  url: string;

  @ApiProperty({ writeOnly: true })
  @IsString()
  @MinLength(8)
  token: string;
}

export class TestArgoCdDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  url: string;

  @ApiProperty({ writeOnly: true })
  @IsString()
  @MinLength(8)
  token: string;
}

export class UpdateWorkspaceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
