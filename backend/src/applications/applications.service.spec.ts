import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ArgocdService } from '../argocd/argocd.service';
import { ArgocdSyncService } from '../argocd/argocd-sync.service';
import { IntegrationsService } from '../integrations/integrations.service';

describe('ApplicationsService', () => {
  let service: ApplicationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: PrismaService, useValue: {} },
        { provide: OrganizationsService, useValue: {} },
        { provide: ArgocdService, useValue: {} },
        { provide: ArgocdSyncService, useValue: {} },
        { provide: IntegrationsService, useValue: {} },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
