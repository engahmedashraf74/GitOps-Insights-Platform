import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';

@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
  ) {}

  @Post()
  create(@Body() body: any) {
    return this.applicationsService.create(
      body.name,
      body.description,
      body.repoUrl,
      body.branch,
      body.path,
      body.projectId,
    );
  }

  @Get(':projectId')
  findAll(
    @Param('projectId') projectId: string,
  ) {
    return this.applicationsService.findAll(
      Number(projectId),
    );
  }

  @Get('repository/:id')
  findRepository(
    @Param('id') id: string,
  ) {
    return this.applicationsService.findRepository(
      Number(id),
    );
  }
}
