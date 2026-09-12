import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ArgocdSyncService } from './argocd-sync.service';

@Injectable()
export class ArgocdSyncJob {
  private readonly logger = new Logger(ArgocdSyncJob.name);

  constructor(private readonly sync: ArgocdSyncService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handle() {
    this.logger.log('Running scheduled Argo CD application sync');
    await this.sync.syncAllConnected();
  }
}
