using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeaAuction.Domain;

namespace TeaAuction.Infrastructure.Persistence.Configurations;

public sealed class UploadBatchConfiguration : IEntityTypeConfiguration<UploadBatch>
{
    public void Configure(EntityTypeBuilder<UploadBatch> builder)
    {
        builder.ToTable("upload_batches");
        builder.HasKey(batch => batch.Id);
        builder.Property(batch => batch.Id).HasColumnName("id");
        builder.Property(batch => batch.SaleId).HasColumnName("sale_id");
        builder.Property(batch => batch.SaleNumber).HasColumnName("sale_number").HasMaxLength(20).IsRequired();
        builder.Property(batch => batch.Year).HasColumnName("year");
        builder.Property(batch => batch.Centre).HasColumnName("centre").HasConversion<string>().HasMaxLength(32);
        builder.Property(batch => batch.SaleDate).HasColumnName("sale_date");
        builder.Property(batch => batch.Broker).HasColumnName("broker").HasConversion<string>().HasMaxLength(8);
        builder.Property(batch => batch.OriginalFileName).HasColumnName("original_file_name").HasMaxLength(260).IsRequired();
        builder.Property(batch => batch.StorageKey).HasColumnName("storage_key").HasMaxLength(500).IsRequired();
        builder.Property(batch => batch.ContentType).HasColumnName("content_type").HasMaxLength(100).IsRequired();
        builder.Property(batch => batch.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(32);
        builder.Property(batch => batch.Error).HasColumnName("error").HasMaxLength(2000);
        builder.Property(batch => batch.LotCount).HasColumnName("lot_count");
        builder.Property(batch => batch.CreatedAt).HasColumnName("created_at");
        builder.Property(batch => batch.ProcessedAt).HasColumnName("processed_at");
        builder.HasOne(batch => batch.Sale)
            .WithMany(sale => sale.Uploads)
            .HasForeignKey(batch => batch.SaleId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
