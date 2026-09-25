import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";

// Control de acceso basado en roles (RBAC), sección 11.3 del documento:
// estudiante, tutor y administrador, propagados en el payload del JWT.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    if (!req.user || !required.includes(req.user.role)) {
      throw new ForbiddenException("Tu rol no tiene permiso para esta acción");
    }
    return true;
  }
}
