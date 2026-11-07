using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeaAuction.Domain;

namespace TeaAuction.Infrastructure.Persistence.Configurations;

public sealed class BlendSheetConfiguration : IEntityTypeConfiguration<BlendSheet>
{
    public void Configure(EntityTypeBuilder<BlendSheet> builder)
    {
        builder.ToTable("blend_sheets");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(x => x.BlendNumber).HasColumnName("blend_number").HasMaxLength(40).IsRequired();
        builder.Property(x => x.BlendDate).HasColumnName("blend_date");
        builder.Property(x => x.SalesOrderRef).HasColumnName("sales_order_ref").HasMaxLength(60);
        builder.Property(x => x.CustomerName).HasColumnName("customer_name").HasMaxLength(160);
        builder.Property(x => x.ProductName).HasColumnName("product_name").HasMaxLength(160);
        builder.Property(x => x.TargetQuantityKg).HasColumnName("target_quantity_kg").HasPrecision(18, 3);
        builder.Property(x => x.TargetPricePerKg).HasColumnName("target_price_per_kg").HasPrecision(18, 2);
        builder.Property(x => x.Currency).HasColumnName("currency").HasMaxLength(8);
        builder.Property(x => x.TargetTeaCostPerKg).HasColumnName("target_tea_cost_per_kg").HasPrecision(18, 2);
        builder.Property(x => x.PreparedBy).HasColumnName("prepared_by").HasMaxLength(120);
        builder.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(32);
        builder.Property(x => x.Remarks).HasColumnName("remarks").HasMaxLength(1000);
        builder.Property(x => x.AllocatedQuantityKg).HasColumnName("allocated_quantity_kg").HasPrecision(18, 3);
        builder.Property(x => x.TotalRawTeaCost).HasColumnName("total_raw_tea_cost").HasPrecision(18, 2);
        builder.Property(x => x.WeightedAverageCostPerKg).HasColumnName("weighted_average_cost_per_kg").HasPrecision(18, 4);
        builder.Property(x => x.Version).HasColumnName("version");
        builder.Property(x => x.CreatedAt).HasColumnName("created_at");
        builder.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        builder.Property(x => x.ConfirmedAt).HasColumnName("confirmed_at");
        builder.HasIndex(x => x.BlendNumber).IsUnique();
        builder.HasIndex(x => x.Status);
        builder.HasMany(x => x.Lines).WithOne(l => l.BlendSheet!).HasForeignKey(l => l.BlendSheetId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(x => x.Reservations).WithOne(r => r.BlendSheet!).HasForeignKey(r => r.BlendSheetId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class BlendSheetLineConfiguration : IEntityTypeConfiguration<BlendSheetLine>
{
    public void Configure(EntityTypeBuilder<BlendSheetLine> builder)
    {
        builder.ToTable("blend_sheet_lines");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(x => x.BlendSheetId).HasColumnName("blend_sheet_id");
        builder.Property(x => x.CollectionLotId).HasColumnName("collection_lot_id");
        builder.Property(x => x.SampleBoxId).HasColumnName("sample_box_id");
        builder.Property(x => x.SaleNumber).HasColumnName("sale_number").HasMaxLength(20);
        builder.Property(x => x.Year).HasColumnName("year");
        builder.Property(x => x.Broker).HasColumnName("broker").HasConversion<string>().HasMaxLength(8);
        builder.Property(x => x.LotNumber).HasColumnName("lot_number");
        builder.Property(x => x.Estate).HasColumnName("estate").HasMaxLength(160);
        builder.Property(x => x.Grade).HasColumnName("grade").HasMaxLength(40);
        builder.Property(x => x.WarehouseOrBasis).HasColumnName("warehouse_or_basis").HasMaxLength(160);
        builder.Property(x => x.PurchasedQtyKg).HasColumnName("purchased_qty_kg").HasPrecision(18, 3);
        builder.Property(x => x.PhysicalStockKg).HasColumnName("physical_stock_kg").HasPrecision(18, 3);
        builder.Property(x => x.AllocatedQtyKg).HasColumnName("allocated_qty_kg").HasPrecision(18, 3);
        builder.Property(x => x.UnitCostPerKg).HasColumnName("unit_cost_per_kg").HasPrecision(18, 2);
        builder.Property(x => x.QualityStatus).HasColumnName("quality_status").HasMaxLength(32);
        builder.Ignore(x => x.LineCost);
        builder.HasIndex(x => new { x.BlendSheetId, x.CollectionLotId }).IsUnique();
        builder.HasOne(x => x.CollectionLot).WithMany().HasForeignKey(x => x.CollectionLotId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class InventoryReservationConfiguration : IEntityTypeConfiguration<InventoryReservation>
{
    public void Configure(EntityTypeBuilder<InventoryReservation> builder)
    {
        builder.ToTable("inventory_reservations");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(x => x.BlendSheetId).HasColumnName("blend_sheet_id");
        builder.Property(x => x.BlendVersion).HasColumnName("blend_version");
        builder.Property(x => x.CollectionLotId).HasColumnName("collection_lot_id");
        builder.Property(x => x.SapItemCode).HasColumnName("sap_item_code").HasMaxLength(60);
        builder.Property(x => x.SapBatchNumber).HasColumnName("sap_batch_number").HasMaxLength(60);
        builder.Property(x => x.WarehouseOrBasis).HasColumnName("warehouse_or_basis").HasMaxLength(160);
        builder.Property(x => x.ReservedQuantityKg).HasColumnName("reserved_quantity_kg").HasPrecision(18, 3);
        builder.Property(x => x.ConsumedQuantityKg).HasColumnName("consumed_quantity_kg").HasPrecision(18, 3);
        builder.Property(x => x.ReleasedQuantityKg).HasColumnName("released_quantity_kg").HasPrecision(18, 3);
        builder.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(32);
        builder.Property(x => x.CreatedBy).HasColumnName("created_by").HasMaxLength(120);
        builder.Property(x => x.CreatedAt).HasColumnName("created_at");
        builder.Property(x => x.UpdatedBy).HasColumnName("updated_by").HasMaxLength(120);
        builder.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        builder.HasIndex(x => new { x.CollectionLotId, x.Status });
        builder.HasIndex(x => x.BlendSheetId);
        builder.HasOne(x => x.CollectionLot).WithMany().HasForeignKey(x => x.CollectionLotId).OnDelete(DeleteBehavior.Restrict);
    }
}
