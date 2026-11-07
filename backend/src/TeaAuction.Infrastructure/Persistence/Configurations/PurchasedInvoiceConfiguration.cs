using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeaAuction.Domain;

namespace TeaAuction.Infrastructure.Persistence.Configurations;

public sealed class PurchasedInvoiceConfiguration : IEntityTypeConfiguration<PurchasedInvoice>
{
    public void Configure(EntityTypeBuilder<PurchasedInvoice> builder)
    {
        builder.ToTable("purchased_invoices");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.SaleId).HasColumnName("sale_id");
        builder.Property(x => x.SaleNumber).HasColumnName("sale_number").HasMaxLength(20).IsRequired();
        builder.Property(x => x.Year).HasColumnName("year");
        builder.Property(x => x.Centre).HasColumnName("centre").HasConversion<string>().HasMaxLength(32);
        builder.Property(x => x.SaleDate).HasColumnName("sale_date");
        builder.Property(x => x.Broker).HasColumnName("broker").HasConversion<string>().HasMaxLength(8);
        builder.Property(x => x.BuyerCode).HasColumnName("buyer_code").HasMaxLength(40);
        builder.Property(x => x.BuyerName).HasColumnName("buyer_name").HasMaxLength(160);
        builder.Property(x => x.ContractNo).HasColumnName("contract_no").HasMaxLength(80);
        builder.Property(x => x.OriginalFileName).HasColumnName("original_file_name").HasMaxLength(260).IsRequired();
        builder.Property(x => x.StorageKey).HasColumnName("storage_key").HasMaxLength(500).IsRequired();
        builder.Property(x => x.ContentType).HasColumnName("content_type").HasMaxLength(100);
        builder.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(32);
        builder.Property(x => x.Error).HasColumnName("error").HasMaxLength(2000);
        builder.Property(x => x.LotCount).HasColumnName("lot_count");
        builder.Property(x => x.NetWeightKg).HasColumnName("net_weight_kg").HasPrecision(18, 2);
        builder.Property(x => x.Proceeds).HasColumnName("proceeds").HasPrecision(18, 2);
        builder.Property(x => x.VatAmount).HasColumnName("vat_amount").HasPrecision(18, 2);
        builder.Property(x => x.Payable).HasColumnName("payable").HasPrecision(18, 2);
        builder.Property(x => x.CreatedAt).HasColumnName("created_at");
        builder.Property(x => x.ProcessedAt).HasColumnName("processed_at");
        builder.HasIndex(x => new { x.Year, x.SaleNumber, x.Broker });
        builder.HasOne(x => x.Sale)
            .WithMany(s => s.PurchasedInvoices)
            .HasForeignKey(x => x.SaleId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasMany(x => x.Lots)
            .WithOne(l => l.PurchasedInvoice!)
            .HasForeignKey(l => l.PurchasedInvoiceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class PurchasedInvoiceLotConfiguration : IEntityTypeConfiguration<PurchasedInvoiceLot>
{
    public void Configure(EntityTypeBuilder<PurchasedInvoiceLot> builder)
    {
        builder.ToTable("purchased_invoice_lots");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.PurchasedInvoiceId).HasColumnName("purchased_invoice_id");
        builder.Property(x => x.Broker).HasColumnName("broker").HasConversion<string>().HasMaxLength(8);
        builder.Property(x => x.LotNumber).HasColumnName("lot_number");
        builder.Property(x => x.SellingMark).HasColumnName("selling_mark").HasMaxLength(80);
        builder.Property(x => x.InvoiceNumber).HasColumnName("invoice_number").HasMaxLength(40);
        builder.Property(x => x.Grade).HasColumnName("grade").HasMaxLength(40);
        builder.Property(x => x.Bags).HasColumnName("bags");
        builder.Property(x => x.NetPerBagKg).HasColumnName("net_per_bag_kg").HasPrecision(18, 2);
        builder.Property(x => x.NetWeightKg).HasColumnName("net_weight_kg").HasPrecision(18, 2);
        builder.Property(x => x.SoldPricePerKg).HasColumnName("sold_price_per_kg").HasPrecision(18, 2);
        builder.Property(x => x.Proceeds).HasColumnName("proceeds").HasPrecision(18, 2);
        builder.Property(x => x.VatAmount).HasColumnName("vat_amount").HasPrecision(18, 2);
        builder.Property(x => x.ProceedsWithVat).HasColumnName("proceeds_with_vat").HasPrecision(18, 2);
        builder.HasIndex(x => new { x.PurchasedInvoiceId, x.LotNumber });
    }
}
