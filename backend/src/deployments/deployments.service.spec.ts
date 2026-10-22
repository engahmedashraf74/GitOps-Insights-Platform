import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentsService } from './deployments.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';

describe('DeploymentsService', () => {
  let service: DeploymentsService;
  const getAccessibleProjectIds = jest.fn();
  const applicationFindFirst = jest.fn();
  const environmentFindFirst = jest.fn();
  const deploymentCreate = jest.fn();

  const dto = {
    revision: 'abc123',
    status: 'Succeeded',
    environment: 'production',
    applicationId: 99,
  };

  beforeEach(async () => {
    getAccessibleProjectIds.mockReset();
    applicationFindFirst.mockReset();
    environmentFindFirst.mockReset();
    deploymentCreate.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeploymentsService,
        {
          provide: PrismaService,
          useValue: {
            application: { findFirst: applicationFindFirst },
            environment: { findFirst: environmentFindFirst },
            deployment: { create: deploymentCreate },
          },
        },
        {
          provide: OrganizationsService,
          useValue: { getAccessibleProjectIds },
        },
      ],
    }).compile();

    service = module.get<DeploymentsService>(DeploymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a deployment only for an application in the caller projects', async () => {
    getAccessibleProjectIds.mockResolvedValue([4]);
    applicationFindFirst.mockResolvedValue({ id: 99 });
    deploymentCreate.mockResolvedValue({ id: 1, applicationId: 99 });

    await service.create(7, dto);

    expect(getAccessibleProjectIds).toHaveBeenCalledWith(7);
    expect(applicationFindFirst).toHaveBeenCalledWith({
      where: { id: 99, projectId: { in: [4] } },
      select: { id: true },
    });
    expect(deploymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ applicationId: 99 }),
      }),
    );
  });

  it('rejects a cross-tenant application id without writing a deployment', async () => {
    getAccessibleProjectIds.mockResolvedValue([4]);
    applicationFindFirst.mockResolvedValue(null);

    await expect(service.create(7, dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(deploymentCreate).not.toHaveBeenCalled();
  });

  it('creates a deployment when environmentId is omitted', async () => {
    getAccessibleProjectIds.mockResolvedValue([4]);
    applicationFindFirst.mockResolvedValue({ id: 99 });
    deploymentCreate.mockResolvedValue({ id: 1 });

    await service.create(7, dto);

    expect(environmentFindFirst).not.toHaveBeenCalled();
    expect(deploymentCreate).toHaveBeenCalled();
  });

  it('accepts an environment that belongs to the authorized application', async () => {
    getAccessibleProjectIds.mockResolvedValue([4]);
    applicationFindFirst.mockResolvedValue({ id: 99 });
    environmentFindFirst.mockResolvedValue({ id: 5 });
    deploymentCreate.mockResolvedValue({ id: 1 });

    await service.create(7, { ...dto, environmentId: 5 });

    expect(environmentFindFirst).toHaveBeenCalledWith({
      where: { id: 5, applicationId: 99 },
      select: { id: true },
    });
    expect(deploymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ applicationId: 99, environmentId: 5 }),
      }),
    );
  });

  it('rejects an environment from another application without writing a deployment', async () => {
    getAccessibleProjectIds.mockResolvedValue([4]);
    applicationFindFirst.mockResolvedValue({ id: 99 });
    environmentFindFirst.mockResolvedValue(null);

    await expect(
      service.create(7, { ...dto, environmentId: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(deploymentCreate).not.toHaveBeenCalled();
  });
});
