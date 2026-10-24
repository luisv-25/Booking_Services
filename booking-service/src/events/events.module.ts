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
          // Consumida por session-service (crea la sala al confirmar).
          queue: "booking_events_queue",
          queueOptions: { durable: true },
        },
      },
      {
        // Cola DEDICADA para payment-service. El transporte RMQ de NestJS
        // entrega cada mensaje a un único consumidor de la cola a la que
        // se publica, así que agregar payment-service como un segundo
        // consumidor de "booking_events_queue" habría repartido los
        // eventos entre session-service y payment-service (competing
        // consumers) en vez de que ambos reciban cada evento. Se publica
        // el mismo contenido en una segunda cola propia para lograr el
        // fan-out real que necesita el nuevo microservicio.
        name: "PAYMENT_EVENTS_CLIENT",
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672"],
          queue: "payment_events_queue",
          queueOptions: { durable: true },
        },
      },
      {
        // Cola DEDICADA para feedback-service, mismo motivo que la de
        // payment arriba. A diferencia de booking.created/confirmed/
        // cancelled (que sí se duplican a las tres colas), booking.completed
        // es un evento nuevo que solo feedback-service necesita, así que
        // solo se publica aquí (ver publishBookingCompleted más abajo).
        name: "FEEDBACK_EVENTS_CLIENT",
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672"],
          queue: "feedback_events_queue",
          queueOptions: { durable: true },
        },
      },
      {
        // Cola DEDICADA para analytics-service, mismo motivo que las demás:
        // una cola propia para no competir por los mensajes con los otros
        // consumidores de booking.confirmed/cancelled.
        name: "ANALYTICS_EVENTS_CLIENT",
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672"],
          queue: "booking_analytics_queue",
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

