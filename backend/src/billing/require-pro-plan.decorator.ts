import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuth } from '../common/decorators/jwt-auth.decorator';
import { ProPlanGuard } from './pro-plan.guard';

export function RequireProPlan() {
  return applyDecorators(JwtAuth(), UseGuards(ProPlanGuard));
}

export function requireProPlan() {
  return RequireProPlan();
}
