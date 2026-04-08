import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller';
import { UsersController } from './users.controller';

@Module({
  controllers: [DriversController, UsersController],
})
export class DriversModule {}
