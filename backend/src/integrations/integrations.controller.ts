import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { ArgocdSyncService } from '../argocd/argocd-sync.service';
import { JwtAuth } from '../common/decorators/jwt-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/types/jwt-user';
import { ConnectArgoCdDto, TestArgoCdDto } from './dto/integration.dto';

@ApiTags('integrations')
@JwtAuth()
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly argocdSync: ArgocdSyncService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List integrations. Tokens are never returned.' })
  list(@CurrentUser() user: JwtUser) {
    return this.integrationsService.list(user);
  }

  @Post('argocd/test')
  test(@CurrentUser() user: JwtUser, @Body() body: TestArgoCdDto) {
    return this.integrationsService.test(user, body.url, body.token);
  }

  @Post('argocd/connect')
  async connect(@CurrentUser() user: JwtUser, @Body() body: ConnectArgoCdDto) {
    const connected = await this.integrationsService.connect(
      user,
      body.url,
      body.token,
    );
    const sync = await this.argocdSync.syncForUser(user.userId);
    return { ...connected, sync };
  }

  @Delete('argocd')
  disconnect(@CurrentUser() user: JwtUser) {
    return this.integrationsService.disconnect(user);
  }
}
