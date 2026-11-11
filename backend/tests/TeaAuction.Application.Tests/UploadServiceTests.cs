using TeaAuction.Application.Catalog;
using TeaAuction.Application.Tests.Fakes;
using TeaAuction.Application.Validation;
using TeaAuction.Domain;

namespace TeaAuction.Application.Tests;

public class UploadServiceTests
{
    [Fact]
    public async Task Stores_the_file_and_schedules_processing()
    {
        var store = new InMemoryCatalogue();
        var service = new UploadService(new CreateUploadValidator(), store, store, store, store);
        await using var content = new MemoryStream("lotNumber\n"u8.ToArray());

        var result = await service.CreateAsync(new CreateUploadCommand
        {
            SaleNumber = " 23 ",
            Year = 2026,
            Centre = "colombo",
            SaleDate = new DateOnly(2026, 5, 5),
            Broker = "as",
            FileName = "lots.csv",
            Length = content.Length
        }, content, CancellationToken.None);

        Assert.True(result.Succeeded);
        var batch = Assert.Single(store.Uploads);
        Assert.Equal(UploadStatus.Pending, batch.Status);
        Assert.Equal(AuctionCentre.Colombo, batch.Centre);
        Assert.Equal(BrokerCode.AS, batch.Broker);
        Assert.Equal("23", batch.SaleNumber);
        Assert.Single(store.Files);
        Assert.Equal(batch.Id, Assert.Single(store.Scheduled));
    }

    [Fact]
    public async Task Does_not_store_an_invalid_upload()
    {
        var store = new InMemoryCatalogue();
        var service = new UploadService(new CreateUploadValidator(), store, store, store, store);

        var result = await service.CreateAsync(new CreateUploadCommand
        {
            SaleNumber = "",
            Year = 2026,
            Centre = "Colombo",
            SaleDate = new DateOnly(2026, 5, 5),
            Broker = "AS",
            FileName = "lots.xlsx",
            Length = 0
        }, Stream.Null, CancellationToken.None);

        Assert.False(result.Succeeded);
        Assert.Empty(store.Uploads);
        Assert.Empty(store.Files);
        Assert.Empty(store.Scheduled);
    }
}
