using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TeaAuction.Infrastructure.Persistence;

public sealed class TeaAuctionDbContextFactory : IDesignTimeDbContextFactory<TeaAuctionDbContext>
{
    public const string DefaultConnectionString =
        "Host=localhost;Port=5432;Database=tea_auction;Username=tea;Password=tea";

    public TeaAuctionDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__Database")
            ?? DefaultConnectionString;
        var options = new DbContextOptionsBuilder<TeaAuctionDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        return new TeaAuctionDbContext(options);
    }
}
