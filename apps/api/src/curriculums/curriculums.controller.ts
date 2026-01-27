import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { CurriculumsService } from './curriculums.service';
import {
  CreateCurriculumDto,
  UpdateCurriculumDto,
  CreateCurriculumItemDto,
  UpdateCurriculumItemDto,
  ListCurriculumsQueryDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller('api/curriculums')
export class CurriculumsController {
  constructor(private readonly curriculumsService: CurriculumsService) {}

  @Get()
  findAll(
    @Query() query: ListCurriculumsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.curriculumsService.findAll(user.userId, query.search);
  }

  @Get(':uuid')
  findOne(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.curriculumsService.findOne(uuid, user.userId);
  }

  @Post()
  create(
    @Body() createCurriculumDto: CreateCurriculumDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.curriculumsService.create(createCurriculumDto, user.userId);
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() updateCurriculumDto: UpdateCurriculumDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.curriculumsService.update(uuid, updateCurriculumDto, user.userId);
  }

  @Delete(':uuid')
  remove(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.curriculumsService.remove(uuid, user.userId);
  }

  // Curriculum Items

  @Post('items')
  createItem(
    @Body() createCurriculumItemDto: CreateCurriculumItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.curriculumsService.createItem(createCurriculumItemDto, user.userId);
  }

  @Get('items/:uuid')
  findItem(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.curriculumsService.findItem(uuid, user.userId);
  }

  @Patch('items/:uuid')
  updateItem(
    @Param('uuid') uuid: string,
    @Body() updateCurriculumItemDto: UpdateCurriculumItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.curriculumsService.updateItem(uuid, updateCurriculumItemDto, user.userId);
  }

  @Delete('items/:uuid')
  removeItem(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.curriculumsService.removeItem(uuid, user.userId);
  }
}
