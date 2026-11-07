using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeaAuction.Domain;

namespace TeaAuction.Infrastructure.Persistence.Configurations;

public sealed class NumberSeriesConfiguration : IEntityTypeConfiguration<NumberSeries>
{
    public void Configure(EntityTypeBuilder<NumberSeries> builder)
    {
        builder.ToTable("number_series");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(x => x.Code).HasColumnName("code").HasMaxLength(40).IsRequired();
        builder.Property(x => x.Prefix).HasColumnName("prefix").HasMaxLength(20).IsRequired();
        builder.Property(x => x.Year).HasColumnName("year");
        builder.Property(x => x.NextNumber).HasColumnName("next_number");
        builder.Property(x => x.PadLength).HasColumnName("pad_length");
        builder.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        builder.HasIndex(x => new { x.Code, x.Year }).IsUnique();
    }
}

public sealed class SampleBoxConfiguration : IEntityTypeConfiguration<SampleBox>
{
    public void Configure(EntityTypeBuilder<SampleBox> builder)
    {
        builder.ToTable("sample_boxes");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(x => x.CollectionBatchId).HasColumnName("collection_batch_id");
        builder.Property(x => x.BoxNumber).HasColumnName("box_number").HasMaxLength(40).IsRequired();
        builder.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(32);
        builder.Property(x => x.LotCount).HasColumnName("lot_count");
        builder.Property(x => x.BagCount).HasColumnName("bag_count");
        builder.Property(x => x.NetWeightKg).HasColumnName("net_weight_kg").HasPrecision(18, 2);
        builder.Property(x => x.WarehouseOrBasis).HasColumnName("warehouse_or_basis").HasMaxLength(160);
        builder.Property(x => x.CollectorName).HasColumnName("collector_name").HasMaxLength(120);
        builder.Property(x => x.Remarks).HasColumnName("remarks").HasMaxLength(500);
        builder.Property(x => x.CreatedAt).HasColumnName("created_at");
        builder.Property(x => x.PrintedAt).HasColumnName("printed_at");
        builder.Property(x => x.PrintCount).HasColumnName("print_count");
        builder.Property(x => x.ReceivedAt).HasColumnName("received_at");
        builder.Property(x => x.ReceivedBy).HasColumnName("received_by").HasMaxLength(120);
        builder.Property(x => x.CompletedAt).HasColumnName("completed_at");
        builder.HasIndex(x => x.BoxNumber).IsUnique();
        builder.HasIndex(x => x.CollectionBatchId);
        builder.HasOne(x => x.CollectionBatch)
            .WithMany(b => b.SampleBoxes)
            .HasForeignKey(x => x.CollectionBatchId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(x => x.Lots)
            .WithOne(l => l.SampleBox!)
            .HasForeignKey(l => l.SampleBoxId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
