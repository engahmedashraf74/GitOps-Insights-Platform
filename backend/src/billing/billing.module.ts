import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { CheckoutSessionService } from './checkout-session.service';
import { StubCheckoutSessionService } from './stub-checkout-session.service';
import { ProPlanGuard } from './pro-plan.guard';

@Module({
  imports: [PrismaModule, OrganizationsModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    ProPlanGuard,
    {
      provide: CheckoutSessionService,
      useClass: StubCheckoutSessionService,
    },
  ],
  exports: [BillingService, CheckoutSessionService, ProPlanGuard],
})
export class BillingModule {}
