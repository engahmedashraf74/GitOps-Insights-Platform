import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentsService } from './environments.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EnvironmentsService', () => {
  let service: EnvironmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvironmentsService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<EnvironmentsService>(EnvironmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
