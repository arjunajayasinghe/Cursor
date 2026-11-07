using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Application.Abstractions;

public interface ICollectionRepository
{
    Task<IReadOnlyList<CollectionBatchSummaryDto>> ListBatchesAsync(CancellationToken cancellationToken);

    Task<CollectionBatchDetailDto?> GetBatchAsync(Guid id, CancellationToken cancellationToken);

    Task<CollectionBatch?> FindOpenBatchAsync(
        AuctionCentre centre,
        int year,
        string saleNumber,
        CancellationToken cancellationToken);

    Task<CollectionBatch?> GetTrackedBatchAsync(Guid id, CancellationToken cancellationToken);

    Task AddBatchAsync(CollectionBatch batch, CancellationToken cancellationToken);

    Task<IReadOnlyList<PurchasedInvoiceLot>> GetInvoiceLotsAsync(
        IReadOnlyCollection<Guid> lotIds,
        CancellationToken cancellationToken);

    Task<IReadOnlyDictionary<(BrokerCode Broker, int LotNumber), Lot>> FindCatalogueLotsAsync(
        Guid saleId,
        IReadOnlyCollection<(BrokerCode Broker, int LotNumber)> keys,
        CancellationToken cancellationToken);

    Task<HashSet<Guid>> FindAlreadySelectedInvoiceLotIdsAsync(
        Guid batchId,
        IReadOnlyCollection<Guid> invoiceLotIds,
        CancellationToken cancellationToken);
}
