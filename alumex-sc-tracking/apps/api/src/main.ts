import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Demo-Role"],
    exposedHeaders: ["X-Demo-Role"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const port = Number(process.env.API_PORT || 4000);
  await app.listen(port);
  console.log(`Alumex API listening on http://localhost:${port}`);
}

bootstrap();
