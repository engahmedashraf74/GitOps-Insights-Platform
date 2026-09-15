import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtAuth } from '../common/decorators/jwt-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/types/jwt-user';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RequireProPlan } from './require-pro-plan.decorator';

class CreateCheckoutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  successUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}

@ApiTags('billing')
@JwtAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('subscription')
  @ApiOperation({ summary: 'Current plan, entitlements, and Free-plan usage' })
  subscription(@CurrentUser() user: JwtUser) {
    return this.billing.getSubscription(user.userId);
  }

  @Get('usage')
  usage(@CurrentUser() user: JwtUser) {
    return this.billing.getUsage(user.userId);
  }

  @Post('checkout')
  @ApiOperation({
    summary: 'Create a checkout session (stub until Stripe keys are configured)',
  })
  checkout(@CurrentUser() user: JwtUser, @Body() body: CreateCheckoutDto) {
    const appUrl = (process.env.APP_URL || 'http://localhost:3001').replace(
      /\/$/,
      '',
    );
    return this.billing.createCheckout(user.userId, {
      plan: 'PRO',
      successUrl: body.successUrl || `${appUrl}/subscription?upgraded=1`,
      cancelUrl: body.cancelUrl || `${appUrl}/upgrade?canceled=1`,
    });
  }

  @Post('stub/activate-pro')
  @ApiOperation({
    summary: 'Development-only Pro activation until Stripe webhooks exist',
  })
  activatePro(@CurrentUser() user: JwtUser) {
    if (process.env.NODE_ENV === 'production') {
      return {
        ok: false,
        message: 'Stripe checkout is not configured for production yet.',
      };
    }
    return this.billing.markStubUpgrade(user.userId);
  }

  @Get('ai/status')
  @RequireProPlan()
  @ApiOperation({ summary: 'Placeholder for Pro-only AI features' })
  aiStatus() {
    return {
      enabled: true,
      available: false,
      message: 'AI insights will be enabled on Pro after public beta.',
    };
  }
}
