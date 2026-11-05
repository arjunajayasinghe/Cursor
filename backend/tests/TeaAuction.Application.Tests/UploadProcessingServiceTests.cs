using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TeaAuction.Application.Catalog;
using TeaAuction.Application.Tests.Fakes;
using TeaAuction.Application.Validation;
using TeaAuction.Domain;

namespace TeaAuction.Application.Tests;

public class UploadProcessingServiceTests
{
    private const string Header = "lotNumber,gardenMark,invoiceNumber,grade,bags,netWeightKg,valuationPerKg";

    [Fact]
    public async Task Creates_a_sale_and_its_lots()
    {
        var store = new InMemoryCatalogue();
        var batch = Pending(store, $"""
            {Header}
            1,Kenilworth,KW-441,BOP,30,810,1320
            2,Lovers Leap,LL-090,Pekoe,12,324,1500
            """);

        await Service(store).ProcessAsync(batch.Id, CancellationToken.None);

        Assert.Equal(UploadStatus.Completed, batch.Status);
        Assert.Equal(2, batch.LotCount);
        var sale = Assert.Single(store.Sales);
        Assert.Equal("23", sale.SaleNumber);
        Assert.Equal(AuctionCentre.Colombo, sale.Centre);
        Assert.Equal(2, store.Lots.Count);
        Assert.All(store.Lots, lot => Assert.Equal(BrokerCode.AS, lot.Broker));
        Assert.Equal(sale.Id, batch.SaleId);
        Assert.Contains(store.Emails, email => email.Subject.Contains("Completed", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Appends_lots_to_an_existing_sale()
    {
        var store = new InMemoryCatalogue();
        var sale = ExistingSale();
        store.Sales.Add(sale);
        store.AddLot(new Lot
        {
            Id = Guid.CreateVersion7(),
            SaleId = sale.Id,
            Broker = BrokerCode.AS,
            LotNumber = 1,
            GardenMark = "Pedro",
            InvoiceNumber = "PD-1",
            Grade = "BOP",
            Bags = 10,
            NetWeightKg = 200
        });
        var batch = Pending(store, $"""
            {Header}
            5,Somerset,SM-9,BOPF,8,160,900
            """);

        await Service(store).ProcessAsync(batch.Id, CancellationToken.None);

        Assert.Equal(UploadStatus.Completed, batch.Status);
        Assert.Equal(sale.Id, batch.SaleId);
        Assert.Equal(2, store.Lots.Count);
        Assert.Single(store.Sales);
    }

    [Fact]
    public async Task Rejects_a_lot_number_already_on_the_sale_for_the_same_broker()
    {
        var store = new InMemoryCatalogue();
        var sale = ExistingSale();
        store.Sales.Add(sale);
        store.Lots.Add(new Lot
        {
            Id = Guid.CreateVersion7(),
            SaleId = sale.Id,
            Broker = BrokerCode.AS,
            LotNumber = 1,
            GardenMark = "Pedro",
            InvoiceNumber = "PD-1",
            Grade = "BOP",
            Bags = 1,
            NetWeightKg = 10
        });
        var batch = Pending(store, $"""
            {Header}
            1,Somerset,SM-9,BOPF,8,160,900
            """);

        await Service(store).ProcessAsync(batch.Id, CancellationToken.None);

        Assert.Equal(UploadStatus.Failed, batch.Status);
        Assert.Contains("already", batch.Error, StringComparison.OrdinalIgnoreCase);
        Assert.Single(store.Lots);
    }

    [Fact]
    public async Task Allows_the_same_lot_number_from_another_broker()
    {
        var store = new InMemoryCatalogue();
        var sale = ExistingSale();
        store.Sales.Add(sale);
        store.Lots.Add(new Lot
        {
            Id = Guid.CreateVersion7(),
            SaleId = sale.Id,
            Broker = BrokerCode.CT,
            LotNumber = 1,
            GardenMark = "Dartry",
            InvoiceNumber = "2398",
            Grade = "BOPF",
            Bags = 20,
            NetWeightKg = 1120
        });
        var batch = Pending(store, $"""
            {Header}
            1,Somerset,SM-9,BOPF,8,160,900
            """);

        await Service(store).ProcessAsync(batch.Id, CancellationToken.None);

        Assert.Equal(UploadStatus.Completed, batch.Status);
        Assert.Equal(2, store.Lots.Count);
    }

    [Fact]
    public async Task Rejects_a_different_sale_date()
    {
        var store = new InMemoryCatalogue();
        var sale = ExistingSale();
        sale.SaleDate = new DateOnly(2026, 4, 28);
        store.Sales.Add(sale);
        var batch = Pending(store, $"""
            {Header}
            8,Somerset,SM-9,BOPF,8,160,900
            """);

        await Service(store).ProcessAsync(batch.Id, CancellationToken.None);

        Assert.Equal(UploadStatus.Failed, batch.Status);
        Assert.Contains("2026-04-28", batch.Error, StringComparison.Ordinal);
        Assert.Empty(store.Lots);
    }

    [Fact]
    public async Task Accepts_a_free_form_broker_grade()
    {
        var store = new InMemoryCatalogue();
        var batch = Pending(store, $"""
            {Header}
            1,Kenilworth,KW-1,FBOPF1,10,100,2000
            """);

        await Service(store).ProcessAsync(batch.Id, CancellationToken.None);

        Assert.Equal(UploadStatus.Completed, batch.Status);
        Assert.Equal("FBOPF1", Assert.Single(store.Lots).Grade);
    }

    private static UploadProcessingService Service(InMemoryCatalogue store) => new(
        store,
        store,
        store,
        new LotCsvParser(),
        new BrokerCatalogueParser(),
        new LotCsvRowValidator(),
        store,
        store,
        Options.Create(new NotificationOptions { OperatorEmail = "ops@tea-auction.local" }),
        NullLogger<UploadProcessingService>.Instance);

    private static Sale ExistingSale() => new()
    {
        Id = Guid.CreateVersion7(),
        SaleNumber = "23",
        Year = 2026,
        Centre = AuctionCentre.Colombo,
        SaleDate = new DateOnly(2026, 5, 5),
        Status = SaleStatus.Open,
        CreatedAt = DateTimeOffset.UtcNow
    };

    private static UploadBatch Pending(InMemoryCatalogue store, string csv)
    {
        var batch = new UploadBatch
        {
            Id = Guid.CreateVersion7(),
            SaleNumber = "23",
            Year = 2026,
            Centre = AuctionCentre.Colombo,
            SaleDate = new DateOnly(2026, 5, 5),
            Broker = BrokerCode.AS,
            OriginalFileName = "lots.csv",
            StorageKey = "mem/lots.csv",
            ContentType = "text/csv",
            Status = UploadStatus.Pending,
            CreatedAt = DateTimeOffset.UtcNow
        };
        store.Uploads.Add(batch);
        store.Store(batch.StorageKey, csv);
        return batch;
    }
}
