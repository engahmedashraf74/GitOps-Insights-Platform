import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { BillingWebhookController } from './billing-webhook.controller';
import { ProPlanGuard } from './pro-plan.guard';

@Module({
  imports: [PrismaModule, OrganizationsModule],
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService, ProPlanGuard],
  exports: [BillingService, ProPlanGuard],
})
export class BillingModule {}
