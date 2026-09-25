import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventsPublisher } from "./events.publisher";
import { SessionCompletedConsumer } from "./session-completed.consumer";
import { Booking } from "../bookings/entities/booking.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking]),
    ClientsModule.register([
      {
        name: "BOOKING_EVENTS_CLIENT",
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672"],
          // Cola de entrega garantizada: los pasos de la saga de reserva no
          // pueden perderse (sección 6.2, regla de decisión del equipo).
          queue: "booking_events_queue",
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  providers: [EventsPublisher],
  controllers: [SessionCompletedConsumer],
  exports: [EventsPublisher],
})
export class EventsModule {}
