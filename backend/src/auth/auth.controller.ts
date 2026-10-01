import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { JwtAuth } from '../common/decorators/jwt-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  RateLimit,
  RateLimitGuard,
} from '../common/rate-limit/rate-limit.guard';
import type { JwtUser } from '../common/types/jwt-user';

@ApiTags('auth')
@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @RateLimit({ limit: 5, windowMs: 60_000 })
  register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.password, body.username);
  }

  @Post('login')
  @RateLimit({ limit: 5, windowMs: 60_000 })
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('verify-email')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  verifyEmail(@Body() body: VerifyEmailDto) {
    return this.authService.verifyEmail(body.token);
  }

  @Post('resend-verification')
  @RateLimit({ limit: 3, windowMs: 300_000 })
  resendVerification(@Body() body: ResendVerificationDto) {
    return this.authService.resendVerification(body.email);
  }

  @Get('me')
  @JwtAuth()
  me(@CurrentUser() user: JwtUser) {
    return this.authService.me(user.userId);
  }
}
