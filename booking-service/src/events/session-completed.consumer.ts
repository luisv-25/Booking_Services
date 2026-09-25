import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Booking, BookingStatus } from "../bookings/entities/booking.entity";

interface SessionCompletedEvent {
  eventName: string;
  occurredAt: string;
  data: { roomId: string; bookingId: string };
}

@Controller()
export class SessionCompletedConsumer {
  private readonly logger = new Logger(SessionCompletedConsumer.name);

  constructor(@InjectRepository(Booking) private readonly bookingsRepo: Repository<Booking>) {}

  // Cierra el ciclo reserva → sala → cobro → valoración (sección 6.8 del
  // documento): cuando Session publica session.completed, la reserva pasa
  // a "completed" y deja de mostrarse como activa en el frontend.
  @EventPattern("session.completed")
  async handleSessionCompleted(
    @Payload() event: SessionCompletedEvent,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    try {
      const booking = await this.bookingsRepo.findOne({ where: { id: event.data.bookingId } });
      if (booking && booking.status === BookingStatus.CONFIRMED) {
        booking.status = BookingStatus.COMPLETED;
        await this.bookingsRepo.save(booking);
        this.logger.log(`Reserva ${booking.id} marcada como completed`);
      }
      channel.ack(originalMsg);
    } catch (err) {
      this.logger.error("Error procesando session.completed", err as Error);
      channel.nack(originalMsg, false, true);
    }
  }
}
