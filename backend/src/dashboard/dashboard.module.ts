import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ArgocdModule } from '../argocd/argocd.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [PrismaModule, ArgocdModule, IntegrationsModule],
  providers: [DashboardService],
  controllers: [DashboardController],
  exports: [DashboardService],
})
export class DashboardModule {}
