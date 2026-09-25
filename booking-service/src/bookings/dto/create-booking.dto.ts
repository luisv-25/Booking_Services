import { IsISO8601, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class CreateBookingDto {
  @IsUUID()
  tutorId: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsISO8601()
  scheduledAt: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  durationMinutes?: number; // default 60 en el servicio
}
