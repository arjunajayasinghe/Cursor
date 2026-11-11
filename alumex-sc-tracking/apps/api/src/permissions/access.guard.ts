import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsService } from "./permissions.service";
import { REQUIRE_ACCESS_KEY, RequireAccessMeta } from "./role.decorator";

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const meta = this.reflector.getAllAndOverride<RequireAccessMeta | undefined>(REQUIRE_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return true;
    const req = context.switchToHttp().getRequest();
    const roleContext = req.roleContext || this.permissions.resolveRole(req.headers?.["x-demo-role"]);
    req.roleContext = roleContext;
    this.permissions.assert(roleContext, meta.moduleKey, meta.minLevel);
    return true;
  }
}
