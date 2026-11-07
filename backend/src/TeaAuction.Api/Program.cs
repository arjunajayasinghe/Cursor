using System.Text.Json.Serialization;
using Hangfire;
using Microsoft.AspNetCore.HttpOverrides;
using Serilog;
using TeaAuction.Api.Auth;
using TeaAuction.Api.Contracts;
using TeaAuction.Api.Endpoints;
using TeaAuction.Api.OpenApi;
using TeaAuction.Application;
using TeaAuction.Infrastructure;
using TeaAuction.Infrastructure.Seeding;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog((context, services, configuration) => configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .WriteTo.Console());

    builder.Services.ConfigureHttpJsonOptions(options =>
    {
        options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

    builder.Services.AddApplication();
    builder.Services.AddInfrastructure(builder.Configuration);

    var connectionString = builder.Configuration.GetConnectionString("Database")
        ?? throw new InvalidOperationException("Connection string 'Database' is not configured.");
    builder.Services.AddHangfire(configuration => configuration
        .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
        .UseSimpleAssemblyNameTypeSerializer()
        .UseRecommendedSerializerSettings()
        .UseTeaAuctionJobStorage(connectionString));
    builder.Services.AddHangfireServer();

    builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
    {
        options.MultipartBodyLengthLimit = 10 * 1024 * 1024;
    });
    builder.WebHost.ConfigureKestrel(options =>
    {
        options.Limits.MaxRequestBodySize = 10 * 1024 * 1024;
    });

    var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>();
    if (origins is null || origins.Length == 0)
        origins = ["http://localhost:5173"];

    builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(policy => policy
            .WithOrigins(origins)
            .AllowAnyHeader()
            .AllowAnyMethod());
    });

    builder.Services.AddOpenApi("v1", options =>
    {
        options.AddDocumentTransformer<ApiKeyDocumentTransformer>();
    });

    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
    });

    var app = builder.Build();

    app.UseForwardedHeaders();
    app.UseSerilogRequestLogging();
    app.UseCors();
    app.UseMiddleware<ApiKeyMiddleware>();

    if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Swagger:Enabled"))
    {
        app.MapOpenApi();
        app.UseSwaggerUI(ui =>
        {
            ui.SwaggerEndpoint("/openapi/v1.json", "Tea Auction Upload API v1");
            ui.RoutePrefix = "swagger";
        });
    }

    if (app.Environment.IsDevelopment())
        app.UseHangfireDashboard("/hangfire");

    app.MapGet("/health", () => Results.Ok(new HealthResponse("ok")))
        .WithName("Health")
        .WithTags("Health")
        .AllowAnonymous();

    app.MapGroup("/api").MapCatalogueEndpoints();
    app.MapGroup("/api").MapPurchasedInvoiceEndpoints();

    // Schema updates run as an explicit `dotnet ef database update` step.
    // The API does not call Database.Migrate() on startup.
    if (app.Configuration.GetValue<bool>("Seed:SampleData"))
    {
        var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
        try
        {
            await using var scope = app.Services.CreateAsyncScope();
            var seeder = scope.ServiceProvider.GetRequiredService<SampleDataSeeder>();
            await seeder.SeedAsync();
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Sample data was not seeded. Apply migrations, then restart the API.");
        }
    }

    app.Run();
}
catch (Exception exception)
{
    Log.Fatal(exception, "The API stopped during startup");
    throw;
}
finally
{
    Log.CloseAndFlush();
}
