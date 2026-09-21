import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtAuth } from '../common/decorators/jwt-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/types/jwt-user';
import { RequireProPlan } from './require-pro-plan.decorator';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@ApiTags('billing')
@JwtAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('subscription')
  @ApiOperation({
    summary: 'Current plan, status, renewal, and Stripe identifiers',
  })
  subscription(@CurrentUser() user: JwtUser) {
    return this.billing.getSubscription(user.userId);
  }

  @Get('usage')
  usage(@CurrentUser() user: JwtUser) {
    return this.billing.getUsage(user.userId);
  }

  @Post('checkout')
  @ApiOperation({
    summary: 'Create a Stripe Checkout session for GitOps Insights Pro',
  })
  checkout(@CurrentUser() user: JwtUser, @Body() body: CreateCheckoutDto = {}) {
    return this.billing.createCheckoutSession(
      user.userId,
      user.email,
      body.promotionCode,
    );
  }

  @Post('portal')
  @ApiOperation({ summary: 'Open the Stripe Customer Billing Portal' })
  portal(@CurrentUser() user: JwtUser) {
    return this.billing.createPortalSession(user.userId);
  }

  @Post('stub/activate-pro')
  @ApiOperation({
    summary: 'Development-only Pro activation when Stripe webhooks are unavailable',
  })
  activatePro(@CurrentUser() user: JwtUser) {
    if (process.env.NODE_ENV === 'production') {
      return {
        ok: false,
        message: 'Use Stripe Checkout in production.',
      };
    }
    return this.billing.markStubUpgrade(user.userId);
  }

  @Get('ai/status')
  @RequireProPlan()
  @ApiOperation({ summary: 'Pro-only AI Deployment Analysis status' })
  aiStatus() {
    return {
      enabled: true,
      available: true,
      message: 'AI Deployment Analysis is included with Pro.',
    };
  }

  @Get('ai/analyze')
  @RequireProPlan()
  @ApiOperation({ summary: 'Pro-only AI Deployment Analysis workspace' })
  aiAnalyze() {
    return {
      enabled: true,
      insights: [],
      message:
        'Connect production telemetry to generate AI deployment analysis. Pro access is active.',
    };
  }
}
