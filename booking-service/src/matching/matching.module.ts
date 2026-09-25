import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from "@nestjs/axios";
import { MatchingRequest } from "../bookings/entities/matching-request.entity";
import { MatchingService } from "./matching.service";
import { MatchingController } from "./matching.controller";
import { CatalogServiceClient } from "../bookings/catalog-service.client";
import { JwtConfigModule } from "../common/jwt-config.module";

@Module({
  imports: [TypeOrmModule.forFeature([MatchingRequest]), HttpModule, JwtConfigModule],
  providers: [MatchingService, CatalogServiceClient],
  controllers: [MatchingController],
})
export class MatchingModule {}
