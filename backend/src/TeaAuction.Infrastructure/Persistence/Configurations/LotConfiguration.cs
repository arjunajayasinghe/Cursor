using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeaAuction.Domain;

namespace TeaAuction.Infrastructure.Persistence.Configurations;

public sealed class LotConfiguration : IEntityTypeConfiguration<Lot>
{
    public void Configure(EntityTypeBuilder<Lot> builder)
    {
        builder.ToTable("lots");
        builder.HasKey(lot => lot.Id);
        builder.Property(lot => lot.Id).HasColumnName("id");
        builder.Property(lot => lot.SaleId).HasColumnName("sale_id");
        builder.Property(lot => lot.UploadBatchId).HasColumnName("upload_batch_id");
        builder.Property(lot => lot.Broker).HasColumnName("broker").HasConversion<string>().HasMaxLength(8);
        builder.Property(lot => lot.LotNumber).HasColumnName("lot_number");
        builder.Property(lot => lot.GardenMark).HasColumnName("garden_mark").HasMaxLength(80).IsRequired();
        builder.Property(lot => lot.InvoiceNumber).HasColumnName("invoice_number").HasMaxLength(40).IsRequired();
        builder.Property(lot => lot.Grade).HasColumnName("grade").HasMaxLength(32).IsRequired();
        builder.Property(lot => lot.Bags).HasColumnName("bags");
        builder.Property(lot => lot.NetWeightKg).HasColumnName("net_weight_kg").HasPrecision(12, 3);
        builder.Property(lot => lot.ValuationPerKg).HasColumnName("valuation_per_kg").HasPrecision(14, 2);
        builder.HasIndex(lot => new { lot.SaleId, lot.Broker, lot.LotNumber }).IsUnique();
        builder.HasOne(lot => lot.Sale)
            .WithMany(sale => sale.Lots)
            .HasForeignKey(lot => lot.SaleId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(lot => lot.UploadBatch)
            .WithMany(batch => batch.Lots)
            .HasForeignKey(lot => lot.UploadBatchId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
