import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { Booking } from "../bookings/entities/booking.entity";

@Injectable()
export class EventsPublisher implements OnModuleInit {
  private readonly logger = new Logger(EventsPublisher.name);

  constructor(
    @Inject("BOOKING_EVENTS_CLIENT") private readonly client: ClientProxy,
    @Inject("PAYMENT_EVENTS_CLIENT") private readonly paymentClient: ClientProxy,
  ) {}

  async onModuleInit() {
    await this.client.connect();
    await this.paymentClient.connect();
  }

  // Publica en AMBAS colas (ver la nota en events.module.ts): la original
  // que ya consume session-service y la nueva dedicada a payment-service.
  // Mismo contenido en las dos, simplemente duplicado a dos colas físicas
  // para lograr un fan-out real.
  private emit(eventName: string, booking: Booking) {
    this.logger.log(`Publicando ${eventName} para booking ${booking.id}`);
    const payload = {
      eventName,
      occurredAt: new Date().toISOString(),
      data: {
        bookingId: booking.id,
        studentId: booking.student_id,
        tutorId: booking.tutor_id,
        subjectId: booking.subject_id,
        status: booking.status,
        scheduledAt: booking.scheduled_at,
        priceSnapshot: booking.price_snapshot,
      },
    };
    this.client.emit(eventName, payload);
    return this.paymentClient.emit(eventName, payload);
  }

  publishBookingCreated(booking: Booking) {
    return this.emit("booking.created", booking);
  }

  publishBookingConfirmed(booking: Booking) {
    return this.emit("booking.confirmed", booking);
  }

  publishBookingCancelled(booking: Booking) {
    return this.emit("booking.cancelled", booking);
  }
}
