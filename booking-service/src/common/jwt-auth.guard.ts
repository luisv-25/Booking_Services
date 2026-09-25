import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import * as jwt from "jsonwebtoken";

export interface AuthUser {
  sub: string; // user_db.users.id
  role: "student" | "tutor" | "admin";
}

// Guardia mínima compartida entre los 4 microservicios: valida el JWT emitido
// por User Service (mismo JWT_SECRET) y expone al usuario autenticado en
// req.user. No requiere consultar a User Service en cada request (sección
// 11.2 del documento de arquitectura).
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header = req.headers["authorization"];
    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedException("Se requiere un token de acceso");
    }
    const token = header.slice(7);
    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || "dev_secret_change_me",
      ) as AuthUser;
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Token inválido o expirado");
    }
  }
}
