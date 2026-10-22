import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsService } from './deployments.service';

describe('DeploymentsController', () => {
  let controller: DeploymentsController;
  const create = jest.fn();

  beforeEach(async () => {
    create.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeploymentsController],
      providers: [{ provide: DeploymentsService, useValue: { create } }],
    }).compile();

    controller = module.get<DeploymentsController>(DeploymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('derives the owner from the authenticated user, not the request body', async () => {
    const body = {
      revision: 'abc123',
      status: 'Succeeded',
      environment: 'production',
      applicationId: 99,
    };
    create.mockResolvedValue({ id: 1 });

    await controller.create({ userId: 7, email: 'owner@example.com' }, body);

    expect(create).toHaveBeenCalledWith(7, body);
  });
});
