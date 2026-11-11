import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import {
  ADMIN_DEMO_SECRET_HEADER,
  DEFAULT_DEMO_ROLE,
  DEMO_ROLE_HEADER,
} from "./permissions.constants";
import { PermissionsService } from "./permissions.service";

@Injectable()
export class RoleMiddleware implements NestMiddleware {
  constructor(private readonly permissions: PermissionsService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    if (req.path === "/health" || req.originalUrl?.startsWith("/health")) {
      return next();
    }

    if (!this.permissions.listRoleNames().length) {
      await this.permissions.refreshCache();
    }

    const requested = String(
      (req.headers[DEMO_ROLE_HEADER] || req.headers["x-demo-role"] || "") as string,
    ).trim();
    const switching = process.env.DEMO_ROLE_SWITCHING === "true";
    const adminSecret = process.env.ADMIN_DEMO_SECRET || "";
    const providedSecret = String(
      (req.headers[ADMIN_DEMO_SECRET_HEADER] || req.headers["x-admin-demo-secret"] || "") as string,
    );

    let roleName = DEFAULT_DEMO_ROLE;
    if (switching && requested) {
      roleName = requested;
    } else if (requested && requested !== "Administrator") {
      // Non-admin roles may be accepted from trusted app proxy / local tooling
      roleName = requested;
    } else if (
      requested === "Administrator" &&
      adminSecret &&
      providedSecret &&
      providedSecret === adminSecret
    ) {
      roleName = "Administrator";
    } else {
      roleName = DEFAULT_DEMO_ROLE;
    }

    (req as Request & { roleContext?: unknown }).roleContext = this.permissions.resolveRole(roleName);
    next();
  }
}
