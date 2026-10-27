import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ArgocdModule } from '../argocd/argocd.module';
import { ConnectorsService } from './connectors.service';
import { ConnectorAgentController, ConnectorsController } from './connectors.controller';

@Module({
  imports: [PrismaModule, OrganizationsModule, ArgocdModule],
  providers: [ConnectorsService],
  controllers: [ConnectorsController, ConnectorAgentController],
})
export class ConnectorsModule {}
