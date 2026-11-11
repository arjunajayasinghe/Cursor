using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeaAuction.Domain;

namespace TeaAuction.Infrastructure.Persistence.Configurations;

public sealed class SaleConfiguration : IEntityTypeConfiguration<Sale>
{
    public void Configure(EntityTypeBuilder<Sale> builder)
    {
        builder.ToTable("sales");
        builder.HasKey(sale => sale.Id);
        builder.Property(sale => sale.Id).HasColumnName("id");
        builder.Property(sale => sale.SaleNumber).HasColumnName("sale_number").HasMaxLength(20).IsRequired();
        builder.Property(sale => sale.Year).HasColumnName("year");
        builder.Property(sale => sale.Centre).HasColumnName("centre").HasConversion<string>().HasMaxLength(32);
        builder.Property(sale => sale.SaleDate).HasColumnName("sale_date");
        builder.Property(sale => sale.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(32);
        builder.Property(sale => sale.CreatedAt).HasColumnName("created_at");
        builder.HasIndex(sale => new { sale.Centre, sale.Year, sale.SaleNumber }).IsUnique();
    }
}
