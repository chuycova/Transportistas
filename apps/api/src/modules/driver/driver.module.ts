import { Module } from '@nestjs/common';
import { DriverAssignmentController } from './driver-assignment.controller';

@Module({
  controllers: [DriverAssignmentController],
})
export class DriverModule {}
