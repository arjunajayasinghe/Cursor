import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get("health")
  health() {
    return {
      ok: true,
      service: "alumex-scc-api",
      auth: "demo-role-header",
      note: "Pass X-Demo-Role for RBAC. Entra ID deferred.",
    };
  }
}
