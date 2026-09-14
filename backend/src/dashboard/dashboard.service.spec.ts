import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { ArgocdService } from '../argocd/argocd.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { OrganizationsService } from '../organizations/organizations.service';

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: {} },
        { provide: OrganizationsService, useValue: {} },
        { provide: ArgocdService, useValue: {} },
        { provide: IntegrationsService, useValue: {} },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
