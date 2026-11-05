using Microsoft.EntityFrameworkCore;
using TeaAuction.Domain;

namespace TeaAuction.Infrastructure.Persistence;

public sealed class TeaAuctionDbContext(DbContextOptions<TeaAuctionDbContext> options) : DbContext(options)
{
    public DbSet<Sale> Sales => Set<Sale>();

    public DbSet<Lot> Lots => Set<Lot>();

    public DbSet<UploadBatch> UploadBatches => Set<UploadBatch>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(TeaAuctionDbContext).Assembly);
    }
}
