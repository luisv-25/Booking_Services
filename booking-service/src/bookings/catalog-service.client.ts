import { HttpService } from "@nestjs/axios";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { AxiosError } from "axios";

@Injectable()
export class CatalogServiceClient {
  private readonly logger = new Logger(CatalogServiceClient.name);
  private readonly baseUrl = process.env.CATALOG_SERVICE_URL || "http://localhost:3002";

  // Comunicación SÍNCRONA hacia Catalog Service: resuelve la tarifa vigente
  // del tutor para el price_snapshot de la reserva (sección 4.3 del doc).
  async getTutorProfile(tutorProfileId: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/tutors/${tutorProfileId}/profile`, {
          timeout: 3000,
        }),
      );
      return data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 404) {
        throw new NotFoundException(`Tutor ${tutorProfileId} no existe en Catalog Service`);
      }
      this.logger.error(`Fallo al consultar Catalog Service para ${tutorProfileId}: ${axiosErr.message}`);
      throw err;
    }
  }

  // Comunicación SÍNCRONA hacia Catalog Service: resuelve la búsqueda de
  // tutores por materia/nivel que usa Matching (sección 4.3 del doc).
  async searchTutors(filters: { subjectId?: string; level?: string }) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/tutors`, {
          params: filters,
          timeout: 3000,
        }),
      );
      return data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      this.logger.error(`Fallo al buscar tutores en Catalog Service: ${axiosErr.message}`);
      throw err;
    }
  }

  constructor(private readonly http: HttpService) {}
}
