import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MatchingRequest } from "../bookings/entities/matching-request.entity";
import { CatalogServiceClient } from "../bookings/catalog-service.client";
import { SearchMatchingDto } from "./dto/search-matching.dto";
import { BadRequestException } from "@nestjs/common";
import { Booking, BookingStatus } from "../bookings/entities/booking.entity";
import { BookingSlot } from "../bookings/entities/booking-slot.entity";


@Injectable()
export class MatchingService {
  constructor(
    @InjectRepository(MatchingRequest)
    private readonly matchingRepo: Repository<MatchingRequest>,
    private readonly catalogServiceClient: CatalogServiceClient,
    
    @InjectRepository(BookingSlot)
    private readonly slotsRepo: Repository<BookingSlot>,

  ) {}

  

  // POST /matching/search (sección 4.3 del documento): registra la
  // búsqueda con sus filtros y delega la resolución en Catalog Service
  // (comunicación síncrona), dejando resolved_at como evidencia de
  // cuánto tardó en resolverse.
  async search(studentId: string, dto: SearchMatchingDto) {
    const request = await this.matchingRepo.save(
      this.matchingRepo.create({
        student_id: studentId,
        filters_json: { ...dto },
        resolved_at: null,
      }),
    );

    const results = await this.catalogServiceClient.searchTutors({
      subjectId: dto.subjectId,
      level: dto.level,
    });

    
    
   
    let filtered = results.filter((t: any) => {
      // Compatible con camelCase y snake_case.
      const hourlyRate = Number(
        t.hourlyRate ?? t.hourly_rate
      );
    
      const avgRating = Number(
        t.avgRating ?? t.avg_rating
      );
    
      if (dto.maxHourlyRate !== undefined) {
        if (
          !Number.isFinite(hourlyRate) ||
          hourlyRate > dto.maxHourlyRate
        ) {
          return false;
        }
      }
    
      if (dto.minRating !== undefined) {
        if (
          !Number.isFinite(avgRating) ||
          avgRating < dto.minRating
        ) {
          return false;
        }
      }
    
      return true;
    });

  
      if (dto.scheduledAt) {
        const startTime = new Date(dto.scheduledAt);
        const durationMinutes = dto.durationMinutes ?? 60;
      
        if (
          !Number.isFinite(startTime.getTime()) ||
          startTime.getTime() <= Date.now()
        ) {
          throw new BadRequestException(
            "El horario solicitado debe ser una fecha futura válida",
          );
        }
      
        const endTime = new Date(
          startTime.getTime() + durationMinutes * 60_000,
        );
      
        // Busca tutores con reservas activas que se solapen
        // con el horario solicitado.
        const occupied = await this.slotsRepo
          .createQueryBuilder("slot")
          .innerJoin(
            Booking,
            "booking",
            "booking.id = slot.booking_id",
          )
          .select("booking.tutor_id", "tutorId")
          .where("booking.status IN (:...statuses)", {
            statuses: [
              BookingStatus.PENDING,
              BookingStatus.CONFIRMED,
            ],
          })
          .andWhere("slot.locked_until > :now", {
            now: new Date(),
          })
          .andWhere("slot.start_time < :endTime", {
            endTime,
          })
          .andWhere("slot.end_time > :startTime", {
            startTime,
          })
          .getRawMany<{ tutorId: string }>();
      
        const occupiedIds = new Set(
          occupied.map((row) => row.tutorId),
        );
      
        filtered = filtered.filter(
          (t: any) => !occupiedIds.has(t.id),
        );
      }
    


    request.resolved_at = new Date();
    await this.matchingRepo.save(request);

    return {
      requestId: request.id,
      resultsCount: filtered.length,
      tutors: filtered,
    };
  }

  history(studentId: string) {
    return this.matchingRepo.find({
      where: { student_id: studentId },
      order: { created_at: "DESC" },
    });
  }
}
