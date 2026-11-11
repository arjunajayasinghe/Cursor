using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeaAuction.Domain;

namespace TeaAuction.Infrastructure.Persistence.Configurations;

public sealed class CollectionBatchConfiguration : IEntityTypeConfiguration<CollectionBatch>
{
    public void Configure(EntityTypeBuilder<CollectionBatch> builder)
    {
        builder.ToTable("collection_batches");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(x => x.SaleId).HasColumnName("sale_id");
        builder.Property(x => x.SaleNumber).HasColumnName("sale_number").HasMaxLength(20).IsRequired();
        builder.Property(x => x.Year).HasColumnName("year");
        builder.Property(x => x.Centre).HasColumnName("centre").HasConversion<string>().HasMaxLength(32);
        builder.Property(x => x.SaleDate).HasColumnName("sale_date");
        builder.Property(x => x.Name).HasColumnName("name").HasMaxLength(160);
        builder.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(32);
        builder.Property(x => x.LotCount).HasColumnName("lot_count");
        builder.Property(x => x.BagCount).HasColumnName("bag_count");
        builder.Property(x => x.NetWeightKg).HasColumnName("net_weight_kg").HasPrecision(18, 2);
        builder.Property(x => x.CreatedAt).HasColumnName("created_at");
        builder.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        builder.HasIndex(x => new { x.Year, x.SaleNumber });
        builder.HasOne(x => x.Sale)
            .WithMany()
            .HasForeignKey(x => x.SaleId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasMany(x => x.Lots)
            .WithOne(l => l.CollectionBatch!)
            .HasForeignKey(l => l.CollectionBatchId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class CollectionLotConfiguration : IEntityTypeConfiguration<CollectionLot>
{
    public void Configure(EntityTypeBuilder<CollectionLot> builder)
    {
        builder.ToTable("collection_lots");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(x => x.CollectionBatchId).HasColumnName("collection_batch_id");
        builder.Property(x => x.PurchasedInvoiceLotId).HasColumnName("purchased_invoice_lot_id");
        builder.Property(x => x.PurchasedInvoiceId).HasColumnName("purchased_invoice_id");
        builder.Property(x => x.CatalogueLotId).HasColumnName("catalogue_lot_id");
        builder.Property(x => x.Broker).HasColumnName("broker").HasConversion<string>().HasMaxLength(8);
        builder.Property(x => x.LotNumber).HasColumnName("lot_number");
        builder.Property(x => x.SellingMark).HasColumnName("selling_mark").HasMaxLength(80);
        builder.Property(x => x.SellerName).HasColumnName("seller_name").HasMaxLength(160);
        builder.Property(x => x.SellerVatNo).HasColumnName("seller_vat_no").HasMaxLength(40);
        builder.Property(x => x.InvoiceNumber).HasColumnName("invoice_number").HasMaxLength(40);
        builder.Property(x => x.Grade).HasColumnName("grade").HasMaxLength(40);
        builder.Property(x => x.Bags).HasColumnName("bags");
        builder.Property(x => x.NetPerBagKg).HasColumnName("net_per_bag_kg").HasPrecision(18, 2);
        builder.Property(x => x.NetWeightKg).HasColumnName("net_weight_kg").HasPrecision(18, 2);
        builder.Property(x => x.SoldPricePerKg).HasColumnName("sold_price_per_kg").HasPrecision(18, 2);
        builder.Property(x => x.Proceeds).HasColumnName("proceeds").HasPrecision(18, 2);
        builder.Property(x => x.VatAmount).HasColumnName("vat_amount").HasPrecision(18, 2);
        builder.Property(x => x.ProceedsWithVat).HasColumnName("proceeds_with_vat").HasPrecision(18, 2);
        builder.Property(x => x.WarehouseOrBasis).HasColumnName("warehouse_or_basis").HasMaxLength(160);
        builder.Property(x => x.BuyerCode).HasColumnName("buyer_code").HasMaxLength(40);
        builder.Property(x => x.BuyerName).HasColumnName("buyer_name").HasMaxLength(160);
        builder.Property(x => x.GardenMark).HasColumnName("garden_mark").HasMaxLength(80);
        builder.Property(x => x.SelectedAt).HasColumnName("selected_at");
        builder.Property(x => x.SampleBoxId).HasColumnName("sample_box_id");
        builder.HasIndex(x => new { x.CollectionBatchId, x.Broker, x.LotNumber }).IsUnique();
        // One PDF invoice lot may appear in collection only once (no duplicates).
        builder.HasIndex(x => x.PurchasedInvoiceLotId)
            .IsUnique()
            .HasFilter("purchased_invoice_lot_id IS NOT NULL");
        builder.HasIndex(x => x.SampleBoxId);
    }
}
