import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Booking, BookingStatus } from "./entities/booking.entity";
import { BookingSlot } from "./entities/booking-slot.entity";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { UserServiceClient } from "./user-service.client";
import { CatalogServiceClient } from "./catalog-service.client";
import { EventsPublisher } from "../events/events.publisher";

interface Requester {
  id: string;
  role: string;
}

const DEFAULT_DURATION_MINUTES = 60;

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private readonly bookingsRepo: Repository<Booking>,
    @InjectRepository(BookingSlot) private readonly slotsRepo: Repository<BookingSlot>,
    private readonly userServiceClient: UserServiceClient,
    private readonly catalogServiceClient: CatalogServiceClient,
    private readonly eventsPublisher: EventsPublisher,
  ) {}

  // Permiso de estudiante: reservar. El studentId sale del token, nunca
  // del body, para que nadie reserve en nombre de otro estudiante.
  async create(studentId: string, dto: CreateBookingDto) {
    // Validación síncrona previa a la escritura (sección 5.10): evita crear
    // una reserva huérfana si el estudiante o el tutor no existen.
    const student = await this.userServiceClient.getUser(studentId);
    if (student.role !== "student") {
      throw new BadRequestException(`El usuario ${studentId} no tiene rol de estudiante`);
    }
    const tutorProfile = await this.catalogServiceClient.getTutorProfile(dto.tutorId);

    const startTime = new Date(dto.scheduledAt);
    const durationMinutes = dto.durationMinutes ?? DEFAULT_DURATION_MINUTES;
    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);

    // Bloqueo optimista contra solapamientos (sección 4.3 del documento):
    // se consulta booking_slots por tutor, uniendo con bookings para saber
    // de quién es cada slot, y se descartan las reservas ya canceladas.
    const overlapping = await this.slotsRepo
      .createQueryBuilder("slot")
      .innerJoin(Booking, "booking", "booking.id = slot.booking_id")
      .where("booking.tutor_id = :tutorId", { tutorId: dto.tutorId })
      .andWhere("booking.status IN (:...activeStatuses)", {
        activeStatuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      })
      .andWhere("slot.locked_until > :now", { now: new Date() })
      .andWhere("slot.start_time < :endTime", { endTime })
      .andWhere("slot.end_time > :startTime", { startTime })
      .getOne();

    if (overlapping) {
      throw new ConflictException(
        `El tutor ya tiene un horario reservado que se solapa con ${startTime.toISOString()} - ${endTime.toISOString()}`,
      );
    }

    const booking = await this.bookingsRepo.save(
      this.bookingsRepo.create({
        student_id: studentId,
        tutor_id: dto.tutorId,
        subject_id: dto.subjectId,
        scheduled_at: startTime,
        price_snapshot: tutorProfile.hourlyRate ?? 0,
        status: BookingStatus.PENDING,
      }),
    );

    await this.slotsRepo.save(
      this.slotsRepo.create({
        booking_id: booking.id,
        start_time: startTime,
        end_time: endTime,
        locked_until: endTime,
      }),
    );

    this.eventsPublisher.publishBookingCreated(booking);
    return booking;
  }

  async findOne(id: string) {
    const booking = await this.bookingsRepo.findOne({ where: { id } });
    if (!booking) throw new NotFoundException(`Reserva ${id} no encontrada`);
    return booking;
  }

  findAll(studentId?: string, tutorId?: string) {
    const where: any = {};
    if (studentId) where.student_id = studentId;
    if (tutorId) where.tutor_id = tutorId;
    return this.bookingsRepo.find({ where, order: { created_at: "DESC" } });
  }

  // Confirma que quien reclama ser el tutor dueño de la reserva realmente
  // lo es, resolviendo la referencia lógica tutor_id (tutor_profile.id)
  // contra Catalog Service (comunicación síncrona, sección 4.3 del doc).
  private async assertOwningTutor(booking: Booking, requester: Requester) {
    if (requester.role === "admin") return;
    if (requester.role !== "tutor") {
      throw new ForbiddenException("Solo el tutor asignado puede realizar esta acción");
    }
    const tutorProfile = await this.catalogServiceClient.getTutorProfile(booking.tutor_id);
    if (tutorProfile.user?.id !== requester.id) {
      throw new ForbiddenException("Esta reserva no está asignada a tu perfil de tutor");
    }
  }

  // Permiso de tutor: ver y decidir sobre las solicitudes de tutoría que le
  // llegan. "Aceptar" reemplaza aquí al paso de pago exitoso de la saga
  // (sección 6.3) porque esta entrega no incluye un Payment Service.
  async accept(id: string, requester: Requester) {
    const booking = await this.findOne(id);
    await this.assertOwningTutor(booking, requester);
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(`La reserva ${id} no está pendiente (status=${booking.status})`);
    }
    booking.status = BookingStatus.CONFIRMED;
    await this.bookingsRepo.save(booking);
    this.eventsPublisher.publishBookingConfirmed(booking);
    return booking;
  }

  // El tutor puede rechazar una solicitud pendiente; el propio estudiante
  // puede retirar su solicitud mientras siga pendiente; un admin puede
  // cancelar cualquier reserva.
  async cancel(id: string, requester: Requester) {
    const booking = await this.findOne(id);
    if (booking.status === BookingStatus.CANCELLED) return booking;

    if (requester.role === "admin") {
      // sin restricción adicional
    } else if (requester.role === "student") {
      if (booking.student_id !== requester.id) {
        throw new ForbiddenException("No puedes cancelar la reserva de otro estudiante");
      }
      if (booking.status !== BookingStatus.PENDING) {
        throw new BadRequestException("Solo puedes retirar una reserva mientras esté pendiente");
      }
    } else if (requester.role === "tutor") {
      await this.assertOwningTutor(booking, requester);
    } else {
      throw new ForbiddenException("No tienes permiso sobre esta reserva");
    }

    booking.status = BookingStatus.CANCELLED;
    await this.bookingsRepo.save(booking);
    // Libera el horario: una vez cancelada, el slot ya no debe bloquear
    // futuras reservas del mismo tutor en esa franja.
    await this.slotsRepo.delete({ booking_id: booking.id });
    this.eventsPublisher.publishBookingCancelled(booking);
    return booking;
  }
}
