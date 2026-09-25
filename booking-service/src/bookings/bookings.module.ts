import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from "@nestjs/axios";
import { Booking } from "./entities/booking.entity";
import { BookingSlot } from "./entities/booking-slot.entity";
import { BookingsService } from "./bookings.service";
import { BookingsController } from "./bookings.controller";
import { UserServiceClient } from "./user-service.client";
import { CatalogServiceClient } from "./catalog-service.client";
import { EventsModule } from "../events/events.module";
import { JwtConfigModule } from "../common/jwt-config.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, BookingSlot]),
    HttpModule,
    EventsModule,
    JwtConfigModule,
  ],
  providers: [BookingsService, UserServiceClient, CatalogServiceClient],
  controllers: [BookingsController],
})
export class BookingsModule {}
