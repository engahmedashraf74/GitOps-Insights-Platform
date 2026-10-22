import { Module } from '@nestjs/common';
import { EnvironmentsService } from './environments.service';
import { EnvironmentsController } from './environments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [PrismaModule, OrganizationsModule],
  providers: [EnvironmentsService],
  controllers: [EnvironmentsController],
})
export class EnvironmentsModule {}
