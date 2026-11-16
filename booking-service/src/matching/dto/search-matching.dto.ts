import { IsNumber, IsOptional, IsString, IsUUID, Min, Max } from "class-validator";

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
  @Max(5)
  minRating?: number;
}
