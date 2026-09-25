import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MatchingRequest } from "../bookings/entities/matching-request.entity";
import { CatalogServiceClient } from "../bookings/catalog-service.client";
import { SearchMatchingDto } from "./dto/search-matching.dto";

@Injectable()
export class MatchingService {
  constructor(
    @InjectRepository(MatchingRequest)
    private readonly matchingRepo: Repository<MatchingRequest>,
    private readonly catalogServiceClient: CatalogServiceClient,
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

    const filtered = dto.maxHourlyRate
      ? results.filter((t: any) => Number(t.hourlyRate) <= dto.maxHourlyRate!)
      : results;

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
