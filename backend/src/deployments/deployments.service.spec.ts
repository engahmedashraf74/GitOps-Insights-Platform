import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentsService } from './deployments.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';

describe('DeploymentsService', () => {
  let service: DeploymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeploymentsService,
        { provide: PrismaService, useValue: {} },
        { provide: OrganizationsService, useValue: {} },
      ],
    }).compile();

    service = module.get<DeploymentsService>(DeploymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
