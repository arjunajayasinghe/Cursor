import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import { RoleContext } from "./permissions.service";

export const REQUIRE_ACCESS_KEY = "require_access";

export type RequireAccessMeta = { moduleKey: string; minLevel: 0 | 1 | 2 };

export const RequireAccess = (moduleKey: string, minLevel: 0 | 1 | 2 = 1) =>
  SetMetadata(REQUIRE_ACCESS_KEY, { moduleKey, minLevel } satisfies RequireAccessMeta);

export const CurrentRole = createParamDecorator((_data: unknown, ctx: ExecutionContext): RoleContext => {
  const req = ctx.switchToHttp().getRequest();
  return req.roleContext as RoleContext;
});
