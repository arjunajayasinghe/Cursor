import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get("health")
  health() {
    return {
      ok: true,
      service: "alumex-scc-api",
      demoAccess: true,
      note: "Permissions / Entra ID deferred — open demo access",
    };
  }
}
