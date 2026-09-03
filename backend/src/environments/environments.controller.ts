import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { EnvironmentsService } from './environments.service';

@Controller('environments')
export class EnvironmentsController {
  constructor(
    private readonly environmentsService: EnvironmentsService,
  ) {}

  @Post()
  create(@Body() body: any) {
    return this.environmentsService.create(
      body.name,
      body.applicationId,
    );
  }

  @Get(':applicationId')
  findAll(
    @Param('applicationId') applicationId: string,
  ) {
    return this.environmentsService.findAll(
      Number(applicationId),
    );
  }
@Delete(':id')
delete(
  @Param('id') id: string,
) {
  return this.environmentsService.delete(
    Number(id),
  );
}
}

