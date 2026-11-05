using TeaAuction.Application.Abstractions;
using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Application.Tests.Fakes;

internal sealed class InMemoryCatalogue :
    ISaleRepository,
    IUploadBatchRepository,
    IUnitOfWork,
    IFileStore,
    IEmailSender,
    IUploadJobScheduler
{
    public List<Sale> Sales { get; } = [];

    public List<UploadBatch> Uploads { get; } = [];

    public List<Lot> Lots { get; } = [];

    public Dictionary<string, byte[]> Files { get; } = new(StringComparer.Ordinal);

    public List<EmailMessage> Emails { get; } = [];

    public List<Guid> Scheduled { get; } = [];

    public int Saves { get; private set; }

    Task<IReadOnlyList<SaleSummaryDto>> ISaleRepository.ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<SaleSummaryDto>>([]);

    public Task<Sale?> GetByIdWithDetailsAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(Sales.FirstOrDefault(sale => sale.Id == id));

    public Task<Sale?> FindByKeyAsync(AuctionCentre centre, int year, string saleNumber, CancellationToken cancellationToken) =>
        Task.FromResult(Sales.FirstOrDefault(sale => sale.Centre == centre && sale.Year == year && sale.SaleNumber == saleNumber));

    public Task AddAsync(Sale sale, CancellationToken cancellationToken)
    {
        Sales.Add(sale);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<int>> FindExistingLotNumbersAsync(
        Guid saleId,
        BrokerCode broker,
        IReadOnlyCollection<int> lotNumbers,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<int> found = Lots
            .Where(lot => lot.SaleId == saleId && lot.Broker == broker && lotNumbers.Contains(lot.LotNumber))
            .Select(lot => lot.LotNumber)
            .ToList();
        return Task.FromResult(found);
    }

    public void AddLot(Lot lot)
    {
        Lots.Add(lot);
        Sales.FirstOrDefault(sale => sale.Id == lot.SaleId)?.Lots.Add(lot);
    }

    public Task AddAsync(UploadBatch batch, CancellationToken cancellationToken)
    {
        Uploads.Add(batch);
        return Task.CompletedTask;
    }

    Task<IReadOnlyList<UploadBatch>> IUploadBatchRepository.ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<UploadBatch>>(
            Uploads.OrderByDescending(batch => batch.CreatedAt).ThenByDescending(batch => batch.Id).ToList());

    public Task<UploadBatch?> GetTrackedAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(Uploads.FirstOrDefault(batch => batch.Id == id));

    public Task<UploadBatch?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        GetTrackedAsync(id, cancellationToken);

    public Task MarkFailedAsync(Guid id, string error, CancellationToken cancellationToken)
    {
        var batch = Uploads.First(item => item.Id == id);
        batch.Status = UploadStatus.Failed;
        batch.Error = error.Length <= 2000 ? error : error[..2000];
        batch.ProcessedAt = DateTimeOffset.UtcNow;
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        Saves++;
        return Task.CompletedTask;
    }

    public async Task<string> SaveAsync(string fileName, Stream content, string contentType, CancellationToken cancellationToken)
    {
        var key = $"mem/{Guid.CreateVersion7():N}-{fileName}";
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);
        Files[key] = buffer.ToArray();
        return key;
    }

    public Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken) =>
        Task.FromResult<Stream>(new MemoryStream(Files[storageKey]));

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        Emails.Add(message);
        return Task.CompletedTask;
    }

    public void EnqueueProcessUpload(Guid uploadBatchId) => Scheduled.Add(uploadBatchId);

    public void Store(string key, string text) => Files[key] = System.Text.Encoding.UTF8.GetBytes(text);
}
