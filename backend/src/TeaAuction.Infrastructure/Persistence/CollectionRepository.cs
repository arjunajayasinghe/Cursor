using Microsoft.EntityFrameworkCore;
using TeaAuction.Application.Abstractions;
using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Infrastructure.Persistence;

public sealed class CollectionRepository(TeaAuctionDbContext db) : ICollectionRepository
{
    public async Task<IReadOnlyList<CollectionBatchSummaryDto>> ListBatchesAsync(CancellationToken cancellationToken)
    {
        var rows = await db.CollectionBatches
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
        return rows.Select(MapSummary).ToList();
    }

    public async Task<CollectionBatchDetailDto?> GetBatchAsync(Guid id, CancellationToken cancellationToken)
    {
        var batch = await db.CollectionBatches
            .AsNoTracking()
            .Include(x => x.Lots)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return batch is null ? null : MapDetail(batch);
    }

    public async Task<CollectionBatch?> FindOpenBatchAsync(
        AuctionCentre centre,
        int year,
        string saleNumber,
        CancellationToken cancellationToken)
    {
        // Do not Include Lots — appending via navigation + Include causes
        // DbUpdateConcurrencyException on SaveChanges when the batch already has rows.
        var open = await db.CollectionBatches
            .Where(x => x.Centre == centre && x.Year == year)
            .Where(x => x.Status == CollectionBatchStatus.Draft || x.Status == CollectionBatchStatus.Selected)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

        return open.FirstOrDefault(x => SaleNumbersMatch(x.SaleNumber, saleNumber));
    }

    private static bool SaleNumbersMatch(string left, string right)
    {
        if (string.Equals(left, right, StringComparison.OrdinalIgnoreCase))
            return true;
        return int.TryParse(left, out var a) && int.TryParse(right, out var b) && a == b;
    }

    public Task AddBatchAsync(CollectionBatch batch, CancellationToken cancellationToken)
    {
        db.CollectionBatches.Add(batch);
        return Task.CompletedTask;
    }

    public Task AddLotsAsync(IReadOnlyList<CollectionLot> lots, CancellationToken cancellationToken)
    {
        if (lots.Count == 0) return Task.CompletedTask;
        db.CollectionLots.AddRange(lots);
        return Task.CompletedTask;
    }

    public async Task RecalcBatchAggregatesAsync(Guid batchId, CancellationToken cancellationToken)
    {
        var batch = await db.CollectionBatches.FirstOrDefaultAsync(x => x.Id == batchId, cancellationToken);
        if (batch is null) return;

        var stats = await db.CollectionLots
            .AsNoTracking()
            .Where(x => x.CollectionBatchId == batchId)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                LotCount = g.Count(),
                BagCount = g.Sum(x => x.Bags),
                NetWeightKg = g.Sum(x => x.NetWeightKg)
            })
            .FirstOrDefaultAsync(cancellationToken);

        batch.LotCount = stats?.LotCount ?? 0;
        batch.BagCount = stats?.BagCount ?? 0;
        batch.NetWeightKg = stats?.NetWeightKg ?? 0;
        batch.UpdatedAt = DateTimeOffset.UtcNow;
    }

    public async Task<IReadOnlyList<PurchasedInvoiceLot>> GetInvoiceLotsAsync(
        IReadOnlyCollection<Guid> lotIds,
        CancellationToken cancellationToken)
    {
        if (lotIds.Count == 0) return [];
        // AsNoTracking so invoice rows are not UPDATE'd during collection SaveChanges.
        return await db.PurchasedInvoiceLots
            .AsNoTracking()
            .Include(x => x.PurchasedInvoice)
            .Where(x => lotIds.Contains(x.Id))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyDictionary<(BrokerCode Broker, int LotNumber), Lot>> FindCatalogueLotsAsync(
        Guid saleId,
        IReadOnlyCollection<(BrokerCode Broker, int LotNumber)> keys,
        CancellationToken cancellationToken)
    {
        if (keys.Count == 0)
            return new Dictionary<(BrokerCode, int), Lot>();

        var brokers = keys.Select(k => k.Broker).Distinct().ToArray();
        var numbers = keys.Select(k => k.LotNumber).Distinct().ToArray();
        var lots = await db.Lots
            .AsNoTracking()
            .Where(l => l.SaleId == saleId && brokers.Contains(l.Broker) && numbers.Contains(l.LotNumber))
            .ToListAsync(cancellationToken);

        var wanted = keys.ToHashSet();
        return lots
            .Where(l => wanted.Contains((l.Broker, l.LotNumber)))
            .GroupBy(l => (l.Broker, l.LotNumber))
            .ToDictionary(g => g.Key, g => g.First());
    }

    public async Task<HashSet<Guid>> FindCollectedInvoiceLotIdsAsync(
        IReadOnlyCollection<Guid> invoiceLotIds,
        CancellationToken cancellationToken)
    {
        if (invoiceLotIds.Count == 0) return [];
        var existing = await db.CollectionLots
            .AsNoTracking()
            .Where(x => x.PurchasedInvoiceLotId != null)
            .Where(x => invoiceLotIds.Contains(x.PurchasedInvoiceLotId!.Value))
            .Select(x => x.PurchasedInvoiceLotId!.Value)
            .ToListAsync(cancellationToken);
        return existing.ToHashSet();
    }

    public async Task<HashSet<Guid>> ListCollectedInvoiceLotIdsForSaleAsync(
        AuctionCentre centre,
        int year,
        string saleNumber,
        CancellationToken cancellationToken)
    {
        var batchIds = await db.CollectionBatches
            .AsNoTracking()
            .Where(x => x.Centre == centre && x.Year == year)
            .Select(x => new { x.Id, x.SaleNumber })
            .ToListAsync(cancellationToken);

        var ids = batchIds
            .Where(x => SaleNumbersMatch(x.SaleNumber, saleNumber))
            .Select(x => x.Id)
            .ToArray();
        if (ids.Length == 0) return [];

        var lotIds = await db.CollectionLots
            .AsNoTracking()
            .Where(x => ids.Contains(x.CollectionBatchId) && x.PurchasedInvoiceLotId != null)
            .Select(x => x.PurchasedInvoiceLotId!.Value)
            .ToListAsync(cancellationToken);
        return lotIds.ToHashSet();
    }

    private static CollectionBatchSummaryDto MapSummary(CollectionBatch batch) =>
        new(
            batch.Id,
            batch.SaleId,
            batch.SaleNumber,
            batch.Year,
            batch.Centre,
            batch.SaleDate,
            batch.Name,
            batch.Status,
            batch.LotCount,
            batch.BagCount,
            batch.NetWeightKg,
            batch.CreatedAt,
            batch.UpdatedAt);

    private static CollectionBatchDetailDto MapDetail(CollectionBatch batch) =>
        new(
            batch.Id,
            batch.SaleId,
            batch.SaleNumber,
            batch.Year,
            batch.Centre,
            batch.SaleDate,
            batch.Name,
            batch.Status,
            batch.LotCount,
            batch.BagCount,
            batch.NetWeightKg,
            batch.CreatedAt,
            batch.UpdatedAt,
            batch.Lots
                .OrderBy(l => l.Broker)
                .ThenBy(l => l.LotNumber)
                .Select(MapLot)
                .ToList());

    private static CollectionLotDto MapLot(CollectionLot lot) =>
        new(
            lot.Id,
            lot.CollectionBatchId,
            lot.PurchasedInvoiceLotId,
            lot.Broker,
            lot.LotNumber,
            lot.SellingMark,
            lot.SellerName,
            lot.SellerVatNo,
            lot.InvoiceNumber,
            lot.Grade,
            lot.Bags,
            lot.NetPerBagKg,
            lot.NetWeightKg,
            lot.SoldPricePerKg,
            lot.Proceeds,
            lot.VatAmount,
            lot.ProceedsWithVat,
            lot.WarehouseOrBasis,
            lot.BuyerCode,
            lot.BuyerName,
            lot.GardenMark,
            lot.SelectedAt);
}
