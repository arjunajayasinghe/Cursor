import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AccessGuard } from "./access.guard";
import { PermissionsController } from "./permissions.controller";
import { PermissionsService } from "./permissions.service";
import { RoleMiddleware } from "./role.middleware";

@Global()
@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService, AccessGuard],
  exports: [PermissionsService, AccessGuard],
})
export class PermissionsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RoleMiddleware).forRoutes("*");
  }
}
