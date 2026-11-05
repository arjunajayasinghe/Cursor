using Amazon.S3;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using TeaAuction.Application.Abstractions;
using TeaAuction.Application.Catalog;
using TeaAuction.Infrastructure.Jobs;
using TeaAuction.Infrastructure.Notifications;
using TeaAuction.Infrastructure.Persistence;
using TeaAuction.Infrastructure.Seeding;
using TeaAuction.Infrastructure.Storage;

namespace TeaAuction.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Database")
            ?? throw new InvalidOperationException("Connection string 'Database' is not configured.");

        services.AddDbContext<TeaAuctionDbContext>(options => options.UseNpgsql(connectionString));
        services.AddScoped<ISaleRepository, SaleRepository>();
        services.AddScoped<IUploadBatchRepository, UploadBatchRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<SampleDataSeeder>();

        services.Configure<FileStoreOptions>(configuration.GetSection(FileStoreOptions.SectionName));
        services.Configure<NotificationOptions>(configuration.GetSection(NotificationOptions.SectionName));

        var provider = configuration.GetSection(FileStoreOptions.SectionName)["Provider"] ?? "FileSystem";
        if (provider.Equals("S3", StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<IAmazonS3>(sp =>
                S3FileStore.CreateClient(sp.GetRequiredService<IOptions<FileStoreOptions>>().Value));
            services.AddSingleton<IFileStore, S3FileStore>();
        }
        else
        {
            services.AddSingleton<IFileStore, FileSystemFileStore>();
        }

        services.AddSingleton<IEmailSender, LoggingEmailSender>();
        services.AddScoped<IUploadJobScheduler, HangfireUploadJobScheduler>();
        return services;
    }

    public static IGlobalConfiguration UseTeaAuctionJobStorage(this IGlobalConfiguration configuration, string connectionString)
    {
        return configuration.UsePostgreSqlStorage(options =>
        {
            options.UseNpgsqlConnection(connectionString);
        });
    }
}
