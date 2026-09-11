import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { JwtAuth } from '../common/decorators/jwt-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/types/jwt-user';
import { ConnectArgoCdDto, TestArgoCdDto } from './dto/integration.dto';

@ApiTags('integrations')
@JwtAuth()
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

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
  connect(@CurrentUser() user: JwtUser, @Body() body: ConnectArgoCdDto) {
    return this.integrationsService.connect(user, body.url, body.token);
  }

  @Delete('argocd')
  disconnect(@CurrentUser() user: JwtUser) {
    return this.integrationsService.disconnect(user);
  }
}
