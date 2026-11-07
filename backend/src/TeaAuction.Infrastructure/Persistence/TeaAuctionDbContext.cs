using Microsoft.EntityFrameworkCore;
using TeaAuction.Domain;

namespace TeaAuction.Infrastructure.Persistence;

public sealed class TeaAuctionDbContext(DbContextOptions<TeaAuctionDbContext> options) : DbContext(options)
{
    public DbSet<Sale> Sales => Set<Sale>();

    public DbSet<Lot> Lots => Set<Lot>();

    public DbSet<UploadBatch> UploadBatches => Set<UploadBatch>();

    public DbSet<PurchasedInvoice> PurchasedInvoices => Set<PurchasedInvoice>();

    public DbSet<PurchasedInvoiceLot> PurchasedInvoiceLots => Set<PurchasedInvoiceLot>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(TeaAuctionDbContext).Assembly);
    }
}
