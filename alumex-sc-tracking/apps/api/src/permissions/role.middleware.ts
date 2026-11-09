import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { DEMO_ROLE_HEADER } from "./permissions.constants";
import { PermissionsService } from "./permissions.service";

@Injectable()
export class RoleMiddleware implements NestMiddleware {
  constructor(private readonly permissions: PermissionsService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // Health checks skip RBAC resolution
    if (req.path === "/health" || req.originalUrl?.startsWith("/health")) {
      return next();
    }
    const header = (req.headers[DEMO_ROLE_HEADER] || req.headers["x-demo-role"]) as string | undefined;
    if (!this.permissions.listRoleNames().length) {
      await this.permissions.refreshCache();
    }
    (req as any).roleContext = this.permissions.resolveRole(header);
    next();
  }
}
