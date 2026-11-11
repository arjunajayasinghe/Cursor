FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY global.json ./
COPY src/TeaAuction.Domain/TeaAuction.Domain.csproj src/TeaAuction.Domain/
COPY src/TeaAuction.Application/TeaAuction.Application.csproj src/TeaAuction.Application/
COPY src/TeaAuction.Infrastructure/TeaAuction.Infrastructure.csproj src/TeaAuction.Infrastructure/
COPY src/TeaAuction.Api/TeaAuction.Api.csproj src/TeaAuction.Api/
RUN dotnet restore src/TeaAuction.Api/TeaAuction.Api.csproj
COPY src/ src/
RUN dotnet publish src/TeaAuction.Api/TeaAuction.Api.csproj -c Release -o /app/publish --no-restore

FROM build AS migrate
COPY dotnet-tools.json ./
RUN dotnet tool restore
ENTRYPOINT ["dotnet", "ef", "database", "update", "--project", "src/TeaAuction.Infrastructure", "--startup-project", "src/TeaAuction.Api"]

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
COPY --from=build /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "TeaAuction.Api.dll"]
