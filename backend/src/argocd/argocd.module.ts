import { Module } from '@nestjs/common';
import { ArgocdService } from './argocd.service';

@Module({
  providers: [ArgocdService],
  exports: [ArgocdService],
})
export class ArgocdModule {}