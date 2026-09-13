import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ArgocdSyncService } from './argocd-sync.service';

@Injectable()
export class ArgocdSyncJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(ArgocdSyncJob.name);

  constructor(private readonly sync: ArgocdSyncService) {}

  onApplicationBootstrap() {
    this.logger.log('[argocd-sync] startup sync scheduled in 5s');
    setTimeout(() => {
      void this.handle();
    }, 5000);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handle() {
    this.logger.log('[argocd-sync] job tick');
    try {
      await this.sync.syncAllConnected();
    } catch (error) {
      this.logger.error(`[argocd-sync] job failed: ${String(error)}`);
    }
  }
}
