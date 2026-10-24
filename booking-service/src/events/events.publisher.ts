import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { Booking } from "../bookings/entities/booking.entity";

@Injectable()
export class EventsPublisher implements OnModuleInit {
  private readonly logger = new Logger(EventsPublisher.name);

  constructor(
    @Inject("BOOKING_EVENTS_CLIENT") private readonly client: ClientProxy,
    @Inject("PAYMENT_EVENTS_CLIENT") private readonly paymentClient: ClientProxy,
    @Inject("FEEDBACK_EVENTS_CLIENT") private readonly feedbackClient: ClientProxy,
    @Inject("ANALYTICS_EVENTS_CLIENT") private readonly analyticsClient: ClientProxy,
  ) {}

  async onModuleInit() {
    await this.client.connect();
    await this.paymentClient.connect();
    await this.feedbackClient.connect();
    await this.analyticsClient.connect();
  }

  // Publica en booking_events_queue (session-service) y payment_events_queue
  // (payment-service): mismo contenido duplicado a dos colas físicas para
  // lograr un fan-out real (ver la nota en events.module.ts).
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
    this.analyticsClient.emit(eventName, payload);
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

  // Evento nuevo (sección 5.11 del documento: "session.completed |
  // Session Service | Matching & Booking Service, Feedback Service,
  // Content Service, Analytics Service"). Booking ya consume
  // session.completed para marcarse completed -- este método publica el
  // paso siguiente de esa misma cadena, ahora con studentId/tutorId que
  // Session Service no tiene, para que Feedback no necesite una llamada
  // síncrona (sección 4.6: "no expone llamadas salientes síncronas").
  publishBookingCompleted(booking: Booking) {
    this.logger.log(`Publicando booking.completed para booking ${booking.id}`);
    return this.feedbackClient.emit("booking.completed", {
      eventName: "booking.completed",
      occurredAt: new Date().toISOString(),
      data: {
        bookingId: booking.id,
        studentId: booking.student_id,
        tutorId: booking.tutor_id,
        subjectId: booking.subject_id,
      },
    });
  }
}
