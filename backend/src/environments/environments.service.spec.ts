import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentsService } from './environments.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';

describe('EnvironmentsService', () => {
  let service: EnvironmentsService;
  const getAccessibleProjectIds = jest.fn();
  const applicationFindFirst = jest.fn();
  const environmentFindUnique = jest.fn();
  const environmentFindMany = jest.fn();
  const environmentCreate = jest.fn();
  const environmentDelete = jest.fn();

  beforeEach(async () => {
    getAccessibleProjectIds.mockReset();
    applicationFindFirst.mockReset();
    environmentFindUnique.mockReset();
    environmentFindMany.mockReset();
    environmentCreate.mockReset();
    environmentDelete.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvironmentsService,
        {
          provide: PrismaService,
          useValue: {
            application: { findFirst: applicationFindFirst },
            environment: {
              findUnique: environmentFindUnique,
              findMany: environmentFindMany,
              create: environmentCreate,
              delete: environmentDelete,
            },
          },
        },
        {
          provide: OrganizationsService,
          useValue: { getAccessibleProjectIds },
        },
      ],
    }).compile();

    service = module.get<EnvironmentsService>(EnvironmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates an environment only for an accessible application', async () => {
    getAccessibleProjectIds.mockResolvedValue([4]);
    applicationFindFirst.mockResolvedValue({ id: 99 });
    environmentCreate.mockResolvedValue({ id: 3, applicationId: 99 });

    await service.create(7, 'production', 99);

    expect(getAccessibleProjectIds).toHaveBeenCalledWith(7);
    expect(applicationFindFirst).toHaveBeenCalledWith({
      where: { id: 99, projectId: { in: [4] } },
      select: { id: true },
    });
    expect(environmentCreate).toHaveBeenCalledWith({
      data: { name: 'production', applicationId: 99 },
    });
  });

  it('rejects a cross-tenant create without writing an environment', async () => {
    getAccessibleProjectIds.mockResolvedValue([4]);
    applicationFindFirst.mockResolvedValue(null);

    await expect(service.create(7, 'production', 99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(environmentCreate).not.toHaveBeenCalled();
  });

  it('lists environments only after the application access check', async () => {
    getAccessibleProjectIds.mockResolvedValue([4]);
    applicationFindFirst.mockResolvedValue({ id: 99 });
    environmentFindMany.mockResolvedValue([]);

    await service.findAll(7, 99);

    expect(environmentFindMany).toHaveBeenCalledWith({
      where: { applicationId: 99 },
    });
  });

  it('rejects a cross-tenant list without reading environments', async () => {
    getAccessibleProjectIds.mockResolvedValue([4]);
    applicationFindFirst.mockResolvedValue(null);

    await expect(service.findAll(7, 99)).rejects.toBeInstanceOf(NotFoundException);
    expect(environmentFindMany).not.toHaveBeenCalled();
  });

  it('deletes an environment only after its application is accessible', async () => {
    getAccessibleProjectIds.mockResolvedValue([4]);
    environmentFindUnique.mockResolvedValue({ id: 8, applicationId: 99 });
    applicationFindFirst.mockResolvedValue({ id: 99 });
    environmentDelete.mockResolvedValue({ id: 8 });

    await service.delete(7, 8);

    expect(environmentFindUnique).toHaveBeenCalledWith({
      where: { id: 8 },
      select: { id: true, applicationId: true },
    });
    expect(applicationFindFirst).toHaveBeenCalledWith({
      where: { id: 99, projectId: { in: [4] } },
      select: { id: true },
    });
    expect(environmentDelete).toHaveBeenCalledWith({ where: { id: 8 } });
  });

  it('rejects a cross-tenant delete without deleting the environment', async () => {
    getAccessibleProjectIds.mockResolvedValue([4]);
    environmentFindUnique.mockResolvedValue({ id: 8, applicationId: 50 });
    applicationFindFirst.mockResolvedValue(null);

    await expect(service.delete(7, 8)).rejects.toBeInstanceOf(NotFoundException);
    expect(environmentDelete).not.toHaveBeenCalled();
  });
});
