import { BadRequestException, ConflictException } from "@nestjs/common";
import { BookingsService } from "../../src/bookings/bookings.service";
import { BookingStatus } from "../../src/bookings/entities/booking.entity";

// Prueba UNITARIA: regla de solapamiento y snapshot de precio al crear una reserva.
// Se simulan repositorios, clientes HTTP (User/Catalog) y el publicador de eventos.
describe("BookingsService.create", () => {
  const dto = { tutorId: "11111111-1111-4111-8111-111111111111", scheduledAt: "2030-01-01T10:00:00.000Z", durationMinutes: 90 };

  function montar(opts: { overlap?: any; role?: string } = {}) {
    const qb: any = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(opts.overlap ?? null),
    };
    const bookingsRepo: any = {
      create: jest.fn((x) => ({ id: "b1", ...x })),
      save: jest.fn(async (x) => x),
    };
    const slotsRepo: any = {
      createQueryBuilder: jest.fn(() => qb),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    const users: any = { getUser: jest.fn().mockResolvedValue({ id: "s1", role: opts.role ?? "student" }) };
    const catalog: any = { getTutorProfile: jest.fn().mockResolvedValue({ hourlyRate: 45000 }) };
    const events: any = { publishBookingCreated: jest.fn() };
    const service = new BookingsService(bookingsRepo, slotsRepo, users, catalog, events);
    return { service, bookingsRepo, slotsRepo, events, catalog };
  }

  it("Unitaria 1: crea la reserva pendiente con precio congelado y slot de la duración pedida; rechaza solapamientos", async () => {
    const ok = montar();
    const booking: any = await ok.service.create("s1", dto);
    expect(booking.status).toBe(BookingStatus.PENDING);
    expect(booking.price_snapshot).toBe(45000);
    const slot = ok.slotsRepo.save.mock.calls[0][0];
    expect(slot.end_time.getTime() - slot.start_time.getTime()).toBe(90 * 60_000);
    expect(slot.locked_until).toEqual(slot.end_time);
    expect(ok.events.publishBookingCreated).toHaveBeenCalledWith(booking);

    // Solapamiento: 409 y no se escribe nada ni se publica evento
    const choque = montar({ overlap: { id: "slot-x" } });
    await expect(choque.service.create("s1", dto)).rejects.toBeInstanceOf(ConflictException);
    expect(choque.bookingsRepo.save).not.toHaveBeenCalled();
    expect(choque.events.publishBookingCreated).not.toHaveBeenCalled();

    // Solo estudiantes pueden reservar
    const tutor = montar({ role: "tutor" });
    await expect(tutor.service.create("t1", dto)).rejects.toBeInstanceOf(BadRequestException);
  });
});
