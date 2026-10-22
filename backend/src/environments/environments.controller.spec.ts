import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentsController } from './environments.controller';
import { EnvironmentsService } from './environments.service';

describe('EnvironmentsController', () => {
  let controller: EnvironmentsController;
  const create = jest.fn();
  const findAll = jest.fn();
  const remove = jest.fn();

  beforeEach(async () => {
    create.mockReset();
    findAll.mockReset();
    remove.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnvironmentsController],
      providers: [
        {
          provide: EnvironmentsService,
          useValue: { create, findAll, delete: remove },
        },
      ],
    }).compile();

    controller = module.get<EnvironmentsController>(EnvironmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('derives the caller from the authenticated user', async () => {
    const user = { userId: 7, email: 'owner@example.com' };
    create.mockResolvedValue({ id: 1 });
    findAll.mockResolvedValue([]);
    remove.mockResolvedValue({ id: 8 });

    await controller.create(user, { name: 'production', applicationId: 99 });
    await controller.findAll(user, 99);
    await controller.delete(user, 8);

    expect(create).toHaveBeenCalledWith(7, 'production', 99);
    expect(findAll).toHaveBeenCalledWith(7, 99);
    expect(remove).toHaveBeenCalledWith(7, 8);
  });
});
