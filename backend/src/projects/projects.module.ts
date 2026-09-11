import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [PrismaModule, OrganizationsModule],
  providers: [ProjectsService],
  controllers: [ProjectsController],
})
export class ProjectsModule {}
