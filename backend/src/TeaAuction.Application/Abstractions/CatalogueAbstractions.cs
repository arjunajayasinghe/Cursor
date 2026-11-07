using TeaAuction.Application.Catalog;
using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Application.Abstractions;

public interface ISaleRepository
{
    Task<IReadOnlyList<SaleSummaryDto>> ListAsync(CancellationToken cancellationToken);

    Task<Sale?> GetByIdWithDetailsAsync(Guid id, CancellationToken cancellationToken);

    Task<Sale?> FindByKeyAsync(AuctionCentre centre, int year, string saleNumber, CancellationToken cancellationToken);

    Task<Sale?> FindByNumericKeyAsync(AuctionCentre centre, int year, string saleNumber, CancellationToken cancellationToken);

    Task AddAsync(Sale sale, CancellationToken cancellationToken);

    Task<IReadOnlyList<int>> FindExistingLotNumbersAsync(
        Guid saleId,
        BrokerCode broker,
        IReadOnlyCollection<int> lotNumbers,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<Lot>> FindTrackedLotsAsync(
        Guid saleId,
        BrokerCode broker,
        IReadOnlyCollection<int> lotNumbers,
        CancellationToken cancellationToken);

    void AddLot(Lot lot);
}

public interface IBrokerCatalogueParser
{
    LotCsvParseResult Parse(BrokerCode broker, Stream content);
}

public interface ISalesResultParser
{
    SalesResultParseResult Parse(BrokerCode broker, string fileName, Stream content);
}

public interface IUploadBatchRepository
{
    Task AddAsync(UploadBatch batch, CancellationToken cancellationToken);

    Task<IReadOnlyList<UploadBatch>> ListAsync(CancellationToken cancellationToken);

    Task<UploadBatch?> GetTrackedAsync(Guid id, CancellationToken cancellationToken);

    Task<UploadBatch?> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<UploadBatch?> GetWithLotsAsync(Guid id, CancellationToken cancellationToken);

    Task MarkFailedAsync(Guid id, string error, CancellationToken cancellationToken);
}

public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken);
}

public interface IFileStore
{
    Task<string> SaveAsync(string fileName, Stream content, string contentType, CancellationToken cancellationToken);

    Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken);
}

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken);
}

public sealed record EmailMessage(string To, string Subject, string Body);

public interface IUploadJobScheduler
{
    void EnqueueProcessUpload(Guid uploadBatchId);
}

public interface ILotCsvParser
{
    LotCsvParseResult Parse(Stream csv);
}

public interface IPurchasedInvoiceRepository
{
    Task AddAsync(PurchasedInvoice invoice, CancellationToken cancellationToken);

    Task<IReadOnlyList<PurchasedInvoiceSummaryDto>> ListAsync(CancellationToken cancellationToken);

    Task<PurchasedInvoiceDetailDto?> GetDetailAsync(Guid id, CancellationToken cancellationToken);

    Task<PurchasedInvoiceWorkbenchDto?> GetWorkbenchAsync(
        string? saleNumber,
        int? year,
        CancellationToken cancellationToken);
}

public static class CatalogueFileKinds
{
    public static bool IsCsv(string fileName) =>
        fileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase);

    public static bool IsBrokerText(string fileName)
    {
        var name = fileName.ToLowerInvariant();
        return name.EndsWith(".txt") || name.EndsWith(".dat");
    }

    public static bool IsExcel(string fileName)
    {
        var name = fileName.ToLowerInvariant();
        return name.EndsWith(".xls") || name.EndsWith(".xlsx");
    }

    public static bool IsSalesFile(string fileName) =>
        IsCsv(fileName) || IsBrokerText(fileName) || IsExcel(fileName);
}
