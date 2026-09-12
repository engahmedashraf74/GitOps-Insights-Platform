import { Module } from '@nestjs/common';
import { ArgocdService } from './argocd.service';
import { ArgocdSyncService } from './argocd-sync.service';
import { ArgocdSyncJob } from './argocd-sync.job';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [PrismaModule, OrganizationsModule],
  providers: [ArgocdService, ArgocdSyncService, ArgocdSyncJob],
  exports: [ArgocdService, ArgocdSyncService],
})
export class ArgocdModule {}
