import { Controller, Get, Patch, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findByUser(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.findByUser(user.userId);
  }

  @Patch()
  update(
    @Body() updateSettingsDto: UpdateSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.update(user.userId, updateSettingsDto);
  }
}
