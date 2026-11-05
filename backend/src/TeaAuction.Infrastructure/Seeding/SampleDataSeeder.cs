using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TeaAuction.Domain;
using TeaAuction.Infrastructure.Persistence;

namespace TeaAuction.Infrastructure.Seeding;

public sealed class SampleDataSeeder(TeaAuctionDbContext db, ILogger<SampleDataSeeder> logger)
{
    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        if (await db.Sales.AnyAsync(cancellationToken))
        {
            logger.LogInformation("Sample seed skipped because sales already exist.");
            return;
        }

        var created = new DateTimeOffset(2026, 4, 21, 8, 30, 0, TimeSpan.Zero);
        var sale = new Sale
        {
            Id = Guid.Parse("6f1c0a3e-8b24-4c1d-9a55-0e2f4a6b7c8d"),
            SaleNumber = "22",
            Year = 2026,
            Centre = AuctionCentre.Colombo,
            SaleDate = new DateOnly(2026, 4, 21),
            Status = SaleStatus.Open,
            CreatedAt = created
        };
        sale.Lots.Add(Lot(sale.Id, "7a2d1b4f-9c35-4d2e-8b66-1f3a5b6c7d8e", BrokerCode.AS, 1, "Pedro", "PD-2201", "BOP", 20, 540.000m, 1250.00m));
        sale.Lots.Add(Lot(sale.Id, "8b3e2c50-ad46-4e3f-9c77-204b6c7d8e9f", BrokerCode.AS, 2, "Somerset", "SM-1184", "BOPF", 40, 1080.500m, 980.00m));
        sale.Lots.Add(Lot(sale.Id, "9c4f3d61-be57-4f40-ad88-315c7d8e9fa0", BrokerCode.AS, 3, "Mattakelle", "MT-0772", "OP", 15, 405.250m, 1100.00m));
        db.Sales.Add(sale);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Seeded Colombo sale 22/2026 with {LotCount} lots.", sale.Lots.Count);
    }

    private static Lot Lot(
        Guid saleId,
        string id,
        BrokerCode broker,
        int lotNumber,
        string garden,
        string invoice,
        string grade,
        int bags,
        decimal netWeightKg,
        decimal valuation) => new()
    {
        Id = Guid.Parse(id),
        SaleId = saleId,
        Broker = broker,
        LotNumber = lotNumber,
        GardenMark = garden,
        InvoiceNumber = invoice,
        Grade = grade,
        Bags = bags,
        NetWeightKg = netWeightKg,
        ValuationPerKg = valuation
    };
}
