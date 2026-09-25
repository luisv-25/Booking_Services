import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingsModule } from "./bookings/bookings.module";
import { MatchingModule } from "./matching/matching.module";
import { EventsModule } from "./events/events.module";
import { Booking } from "./bookings/entities/booking.entity";
import { BookingSlot } from "./bookings/entities/booking-slot.entity";
import { MatchingRequest } from "./bookings/entities/matching-request.entity";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT) || 5435,
      username: process.env.DB_USER || "booking_svc",
      password: process.env.DB_PASSWORD || "booking_svc_pw",
      database: process.env.DB_NAME || "booking_db",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      entities: [Booking, BookingSlot, MatchingRequest],
      synchronize: process.env.DB_SYNCHRONIZE !== "false", // válido para esta entrega local, igual que en el resto de servicios
    }),
    EventsModule,
    BookingsModule,
    MatchingModule,
  ],
})
export class AppModule {}
