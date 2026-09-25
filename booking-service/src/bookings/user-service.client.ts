import { HttpService } from "@nestjs/axios";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { AxiosError } from "axios";

@Injectable()
export class UserServiceClient {
  private readonly logger = new Logger(UserServiceClient.name);
  private readonly baseUrl = process.env.USER_SERVICE_URL || "http://localhost:3001";

  // Comunicación SÍNCRONA hacia User Service: valida rol/existencia antes
  // de crear la reserva (sección 4.3 del documento de arquitectura).
  async getUser(userId: string) {
  const url = `${this.baseUrl}/api/v1/users/${userId}`;

  try {
    this.logger.log(`Consultando User Service: ${url}`);

    const { data } = await firstValueFrom(
      this.http.get(url, {
        timeout: 3000,
      }),
    );

    return data;
  } catch (err) {
    const axiosErr = err as AxiosError;

    this.logger.error(
      `User Service respondió ${axiosErr.response?.status} para ${url}`,
      JSON.stringify(axiosErr.response?.data),
    );

    if (axiosErr.response?.status === 404) {
      throw new NotFoundException(
        `Usuario ${userId} no existe en User Service`,
      );
    }

    throw err;
  }
}
}
