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

    Task AddBatchAsync(CollectionBatch batch, CancellationToken cancellationToken);

    Task AddLotsAsync(IReadOnlyList<CollectionLot> lots, CancellationToken cancellationToken);

    Task RecalcBatchAggregatesAsync(Guid batchId, CancellationToken cancellationToken);

    Task<IReadOnlyList<PurchasedInvoiceLot>> GetInvoiceLotsAsync(
        IReadOnlyCollection<Guid> lotIds,
        CancellationToken cancellationToken);

    Task<IReadOnlyDictionary<(BrokerCode Broker, int LotNumber), Lot>> FindCatalogueLotsAsync(
        Guid saleId,
        IReadOnlyCollection<(BrokerCode Broker, int LotNumber)> keys,
        CancellationToken cancellationToken);

    /// <summary>Invoice lot IDs already copied into any collection batch (global — no duplicates).</summary>
    Task<HashSet<Guid>> FindCollectedInvoiceLotIdsAsync(
        IReadOnlyCollection<Guid> invoiceLotIds,
        CancellationToken cancellationToken);

    /// <summary>All collected invoice lot IDs for a sale (for UI lockout).</summary>
    Task<HashSet<Guid>> ListCollectedInvoiceLotIdsForSaleAsync(
        AuctionCentre centre,
        int year,
        string saleNumber,
        CancellationToken cancellationToken);
}
