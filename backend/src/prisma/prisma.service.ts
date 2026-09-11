import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    const attempts = 15;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await this.$connect();
        this.logger.log('Connected to Postgres');
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        this.logger.warn(
          `Postgres connection attempt ${attempt}/${attempts} failed: ${message}`,
        );

        if (attempt === attempts) {
          throw error;
        }

        await delay(2000);
      }
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
