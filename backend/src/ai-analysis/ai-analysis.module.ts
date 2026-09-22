import { Module } from '@nestjs/common';
import { AiAnalysisService } from './ai-analysis.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ApplicationsModule } from '../applications/applications.module';
import { ArgocdModule } from '../argocd/argocd.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [PrismaModule, ApplicationsModule, ArgocdModule, IntegrationsModule],
  providers: [AiAnalysisService],
  exports: [AiAnalysisService],
})
export class AiAnalysisModule {}
