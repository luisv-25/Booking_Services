import { IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class SearchMatchingDto {
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxHourlyRate?: number;
}
