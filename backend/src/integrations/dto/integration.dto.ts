import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConnectArgoCdDto {
  @ApiProperty({ example: 'https://argocd.example.com' })
  @IsUrl({ require_tld: false })
  url: string;

  @ApiProperty({ writeOnly: true })
  @IsString()
  @MinLength(8)
  token: string;
}

export class TestArgoCdDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
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
