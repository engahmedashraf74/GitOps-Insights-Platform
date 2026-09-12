import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { ApplicationsModule } from './applications/applications.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { EnvironmentsModule } from './environments/environments.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ArgocdModule } from './argocd/argocd.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { IntegrationsModule } from './integrations/integrations.module';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'backend',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    OrganizationsModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    ApplicationsModule,
    DeploymentsModule,
    EnvironmentsModule,
    DashboardModule,
    ArgocdModule,
    WorkspaceModule,
    IntegrationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
