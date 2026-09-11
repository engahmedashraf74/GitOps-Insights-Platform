import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'you@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @MinLength(8)
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: 'platform-admin' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username?: string;
}

export class LoginDto {
  @ApiProperty({
    description: 'Email or username',
    example: 'you@company.com',
  })
  @IsString()
  @MinLength(1)
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password: string;
}
