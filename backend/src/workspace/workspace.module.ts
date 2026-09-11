import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';

@Module({
  imports: [PrismaModule, OrganizationsModule],
  providers: [WorkspaceService],
  controllers: [WorkspaceController],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
