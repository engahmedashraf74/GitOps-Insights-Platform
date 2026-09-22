import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { BillingWebhookController } from './billing-webhook.controller';
import { AiAnalysisModule } from '../ai-analysis/ai-analysis.module';
import { ProPlanGuard } from './pro-plan.guard';

@Module({
  imports: [PrismaModule, OrganizationsModule, AiAnalysisModule],
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService, ProPlanGuard],
  exports: [BillingService, ProPlanGuard],
})
export class BillingModule {}
