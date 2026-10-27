import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateConnectorDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  argoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  caCertificate?: string;
}

export class EnrollConnectorDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  enrollmentToken!: string;
}

export class ConnectorReportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  error!: string;
}
