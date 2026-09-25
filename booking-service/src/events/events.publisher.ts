import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { Booking } from "../bookings/entities/booking.entity";

@Injectable()
export class EventsPublisher implements OnModuleInit {
  private readonly logger = new Logger(EventsPublisher.name);

  constructor(@Inject("BOOKING_EVENTS_CLIENT") private readonly client: ClientProxy) {}

  async onModuleInit() {
    await this.client.connect();
  }

  private emit(eventName: string, booking: Booking) {
    this.logger.log(`Publicando ${eventName} para booking ${booking.id}`);
    return this.client.emit(eventName, {
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
    });
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
