import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { MatchingService } from "./matching.service";
import { SearchMatchingDto } from "./dto/search-matching.dto";
import { JwtRolesGuard } from "../common/jwt-roles.guard";
import { Roles } from "../common/roles.decorator";

@Controller("matching")
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post("search")
  @UseGuards(JwtRolesGuard)
  @Roles("student")
  search(@Body() dto: SearchMatchingDto, @Req() req: any) {
    return this.matchingService.search(req.user.id, dto);
  }

  @Get("history")
  @UseGuards(JwtRolesGuard)
  @Roles("student")
  history(@Req() req: any) {
    return this.matchingService.history(req.user.id);
  }
}
