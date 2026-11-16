import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { BookingsService } from "../../src/bookings/bookings.service";
import { BookingStatus } from "../../src/bookings/entities/booking.entity";

// Prueba UNITARIA: reglas de cancelación y aceptación (permisos por rol, liberación del horario).
describe("BookingsService.cancel / accept", () => {
  function montar(booking: any, tutorUserId = "tutor-user") {
    const bookingsRepo: any = { findOne: jest.fn().mockResolvedValue(booking), save: jest.fn(async (x) => x) };
    const slotsRepo: any = { delete: jest.fn().mockResolvedValue({}) };
    const catalog: any = { getTutorProfile: jest.fn().mockResolvedValue({ user: { id: tutorUserId } }) };
    const events: any = {
      publishBookingCancelled: jest.fn(),
      publishBookingConfirmed: jest.fn(),
    };
    const service = new BookingsService(bookingsRepo, slotsRepo, {} as any, catalog, events);
    return { service, slotsRepo, events };
  }
  const nueva = (status = BookingStatus.PENDING) => ({ id: "b1", student_id: "s1", tutor_id: "tp1", status });

  it("Unitaria 2: la cancelación libera el slot y emite booking.cancelled; respeta permisos por rol y estado", async () => {
    // Estudiante dueño cancela una pendiente: libera el slot y publica el evento
    const a = montar(nueva());
    const res = await a.service.cancel("b1", { id: "s1", role: "student" });
    expect(res.status).toBe(BookingStatus.CANCELLED);
    expect(a.slotsRepo.delete).toHaveBeenCalledWith({ booking_id: "b1" });
    expect(a.events.publishBookingCancelled).toHaveBeenCalledTimes(1);

    // Estudiante ajeno -> 403; estudiante con reserva ya confirmada -> 400
    await expect(montar(nueva()).service.cancel("b1", { id: "otro", role: "student" })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(montar(nueva(BookingStatus.CONFIRMED)).service.cancel("b1", { id: "s1", role: "student" })).rejects.toBeInstanceOf(BadRequestException);

    // Tutor que no es el dueño -> 403; el dueño sí puede rechazar
    await expect(montar(nueva(), "otro-tutor").service.cancel("b1", { id: "tutor-user", role: "tutor" })).rejects.toBeInstanceOf(ForbiddenException);
    const dueno = montar(nueva());
    expect((await dueno.service.cancel("b1", { id: "tutor-user", role: "tutor" })).status).toBe(BookingStatus.CANCELLED);

    // Idempotente: cancelar una ya cancelada no repite efectos
    const c = montar(nueva(BookingStatus.CANCELLED));
    await c.service.cancel("b1", { id: "s1", role: "student" });
    expect(c.slotsRepo.delete).not.toHaveBeenCalled();
    expect(c.events.publishBookingCancelled).not.toHaveBeenCalled();
  });

  it("el tutor dueño acepta una reserva pendiente (confirmed + evento) y no puede aceptarla dos veces", async () => {
    const m = montar(nueva());
    const res = await m.service.accept("b1", { id: "tutor-user", role: "tutor" });
    expect(res.status).toBe(BookingStatus.CONFIRMED);
    expect(m.events.publishBookingConfirmed).toHaveBeenCalledTimes(1);
    await expect(m.service.accept("b1", { id: "tutor-user", role: "tutor" })).rejects.toBeInstanceOf(BadRequestException);
  });
});
