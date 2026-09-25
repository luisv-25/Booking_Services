import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { BookingsService } from "./bookings.service";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { JwtRolesGuard } from "../common/jwt-roles.guard";
import { Roles } from "../common/roles.decorator";

@Controller("bookings")
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // Permiso de estudiante: reservar.
  @Post()
  @UseGuards(JwtRolesGuard)
  @Roles("student")
  create(@Body() dto: CreateBookingDto, @Req() req: any) {
    return this.bookingsService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Query("studentId") studentId?: string, @Query("tutorId") tutorId?: string) {
    return this.bookingsService.findAll(studentId, tutorId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.bookingsService.findOne(id);
  }

  // Permiso de tutor: aceptar la solicitud de tutoría que le llegó.
  @Patch(":id/accept")
  @UseGuards(JwtRolesGuard)
  accept(@Param("id") id: string, @Req() req: any) {
    return this.bookingsService.accept(id, req.user);
  }

  // El tutor rechaza, el estudiante retira su propia solicitud pendiente,
  // o un admin cancela cualquier reserva (la lógica de quién puede qué
  // vive en BookingsService.cancel).
  @Patch(":id/cancel")
  @UseGuards(JwtRolesGuard)
  cancel(@Param("id") id: string, @Req() req: any) {
    return this.bookingsService.cancel(id, req.user);
  }
}
