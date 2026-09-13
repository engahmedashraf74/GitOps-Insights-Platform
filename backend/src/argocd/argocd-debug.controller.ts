import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArgocdSyncService } from './argocd-sync.service';
import { JwtAuth } from '../common/decorators/jwt-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/types/jwt-user';

@ApiTags('argocd')
@JwtAuth()
@Controller('argocd')
export class ArgocdDebugController {
  constructor(private readonly sync: ArgocdSyncService) {}

  @Get('debug')
  @ApiOperation({
    summary: 'Temporary Argo CD integration diagnostics (no tokens returned)',
  })
  debug(@CurrentUser() user: JwtUser) {
    return this.sync.debugForUser(user.userId);
  }
}
