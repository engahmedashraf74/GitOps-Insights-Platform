import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuth } from '../common/decorators/jwt-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/types/jwt-user';
import { ConnectorsService } from './connectors.service';
import {
  ConnectorReportDto,
  CreateConnectorDto,
  EnrollConnectorDto,
} from './dto/connector.dto';

function credentialFrom(header: string | undefined): string {
  if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
  return header.slice('Bearer '.length).trim();
}

@ApiTags('connectors')
@JwtAuth()
@Controller('connectors')
export class ConnectorsController {
  constructor(private readonly connectors: ConnectorsService) {}

  @Get()
  @ApiOperation({ summary: 'List private-cluster connectors. Secrets are never returned.' })
  list(@CurrentUser() user: JwtUser) {
    return this.connectors.list(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a one-time enrollment for a private cluster.' })
  create(@CurrentUser() user: JwtUser, @Body() body: CreateConnectorDto) {
    return this.connectors.create(user.userId, body.name, body.argoUrl, body.caCertificate);
  }

  @Post(':id/enrollment')
  @ApiOperation({ summary: 'Revoke the current agent credential and issue a new enrollment.' })
  rotate(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.connectors.rotate(user.userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a connector. The agent can no longer submit data.' })
  revoke(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.connectors.revoke(user.userId, id);
  }
}

@ApiTags('connectors')
@Controller('connectors/agent')
export class ConnectorAgentController {
  constructor(private readonly connectors: ConnectorsService) {}

  @Post('enroll')
  enroll(@Body() body: EnrollConnectorDto) {
    return this.connectors.enroll(body.enrollmentToken);
  }

  @Post('heartbeat')
  heartbeat(@Headers('authorization') authorization?: string) {
    return this.connectors.heartbeat(credentialFrom(authorization));
  }

  @Post('snapshot')
  snapshot(
    @Headers('authorization') authorization: string | undefined,
    @Req() request: { body: unknown },
  ) {
    return this.connectors.snapshot(credentialFrom(authorization), request.body);
  }

  @Post('report')
  report(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ConnectorReportDto,
  ) {
    return this.connectors.report(credentialFrom(authorization), body.error);
  }
}
