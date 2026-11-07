using Microsoft.EntityFrameworkCore;
using TeaAuction.Application.Abstractions;
using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Infrastructure.Persistence;

public sealed class SampleBoxRepository(TeaAuctionDbContext db) : ISampleBoxRepository
{
    public const string SampleBoxSeriesCode = "SAMPLE_BOX";

    public async Task<IReadOnlyList<SampleBoxSummaryDto>> ListByBatchAsync(
        Guid batchId,
        CancellationToken cancellationToken)
    {
        var rows = await db.SampleBoxes
            .AsNoTracking()
            .Where(x => x.CollectionBatchId == batchId)
            .OrderBy(x => x.BoxNumber)
            .ToListAsync(cancellationToken);
        return rows.Select(MapSummary).ToList();
    }

    public async Task<SampleBoxDetailDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var box = await db.SampleBoxes
            .AsNoTracking()
            .Include(x => x.Lots)
            .Include(x => x.CollectionBatch)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return box is null ? null : MapDetail(box);
    }

    public Task<CollectionBatch?> GetTrackedBatchAsync(Guid batchId, CancellationToken cancellationToken) =>
        db.CollectionBatches.FirstOrDefaultAsync(x => x.Id == batchId, cancellationToken);

    public async Task<IReadOnlyList<CollectionLot>> GetTrackedLotsAsync(
        Guid batchId,
        IReadOnlyCollection<Guid> lotIds,
        CancellationToken cancellationToken)
    {
        if (lotIds.Count == 0) return [];
        return await db.CollectionLots
            .Where(x => x.CollectionBatchId == batchId && lotIds.Contains(x.Id))
            .ToListAsync(cancellationToken);
    }

    public Task AddBoxesAsync(IReadOnlyList<SampleBox> boxes, CancellationToken cancellationToken)
    {
        if (boxes.Count == 0) return Task.CompletedTask;
        db.SampleBoxes.AddRange(boxes);
        return Task.CompletedTask;
    }

    public async Task<string> AllocateBoxNumberAsync(int year, CancellationToken cancellationToken)
    {
        // Mutate in-memory only — caller SaveChanges persists series + boxes + lot FKs together
        // so we never write SampleBoxId before the box row exists.
        var series = await db.NumberSeries
            .FirstOrDefaultAsync(x => x.Code == SampleBoxSeriesCode && x.Year == year, cancellationToken);

        if (series is null)
        {
            series = new NumberSeries
            {
                Id = Guid.CreateVersion7(),
                Code = SampleBoxSeriesCode,
                Prefix = "BOX",
                Year = year,
                NextNumber = 1,
                PadLength = 6,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.NumberSeries.Add(series);
        }

        var number = series.NextNumber;
        series.NextNumber = number + 1;
        series.UpdatedAt = DateTimeOffset.UtcNow;
        return series.Format(number);
    }

    public async Task RecalcBatchStatusAsync(Guid batchId, CancellationToken cancellationToken)
    {
        var batch = await db.CollectionBatches.FirstOrDefaultAsync(x => x.Id == batchId, cancellationToken);
        if (batch is null) return;

        var boxes = await db.SampleBoxes
            .AsNoTracking()
            .Where(x => x.CollectionBatchId == batchId && x.Status != SampleBoxStatus.Cancelled)
            .Select(x => x.Status)
            .ToListAsync(cancellationToken);

        if (boxes.Count == 0)
        {
            batch.Status = CollectionBatchStatus.Selected;
        }
        else if (boxes.All(s => s is SampleBoxStatus.Received or SampleBoxStatus.Completed))
        {
            batch.Status = CollectionBatchStatus.Closed;
        }
        else if (boxes.Any(s => s is SampleBoxStatus.Printed or SampleBoxStatus.Received or SampleBoxStatus.Completed))
        {
            batch.Status = CollectionBatchStatus.Collecting;
        }
        else
        {
            batch.Status = CollectionBatchStatus.Planning;
        }

        batch.UpdatedAt = DateTimeOffset.UtcNow;
    }

    public Task<SampleBox?> GetTrackedBoxAsync(Guid id, CancellationToken cancellationToken) =>
        db.SampleBoxes.Include(x => x.Lots).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public async Task<IReadOnlyList<SampleBox>> GetTrackedBoxesAsync(
        IReadOnlyCollection<Guid> ids,
        CancellationToken cancellationToken)
    {
        if (ids.Count == 0) return [];
        return await db.SampleBoxes
            .Include(x => x.Lots)
            .Where(x => ids.Contains(x.Id))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SampleBox>> GetTrackedActiveBoxesForBatchAsync(
        Guid batchId,
        CancellationToken cancellationToken)
    {
        return await db.SampleBoxes
            .Include(x => x.Lots)
            .Where(x => x.CollectionBatchId == batchId && x.Status != SampleBoxStatus.Cancelled)
            .ToListAsync(cancellationToken);
    }

    public async Task ClearLotBoxLinksAsync(
        IReadOnlyCollection<Guid> boxIds,
        CancellationToken cancellationToken)
    {
        if (boxIds.Count == 0) return;
        var lots = await db.CollectionLots
            .Where(x => x.SampleBoxId != null && boxIds.Contains(x.SampleBoxId.Value))
            .ToListAsync(cancellationToken);
        foreach (var lot in lots)
            lot.SampleBoxId = null;
    }

    public async Task<bool> BatchReadyForBlendingAsync(Guid batchId, CancellationToken cancellationToken)
    {
        var lotCount = await db.CollectionLots.CountAsync(x => x.CollectionBatchId == batchId, cancellationToken);
        if (lotCount == 0) return false;

        var unboxed = await db.CollectionLots.CountAsync(
            x => x.CollectionBatchId == batchId && x.SampleBoxId == null,
            cancellationToken);
        if (unboxed > 0) return false;

        var boxes = await db.SampleBoxes
            .AsNoTracking()
            .Where(x => x.CollectionBatchId == batchId && x.Status != SampleBoxStatus.Cancelled)
            .Select(x => x.Status)
            .ToListAsync(cancellationToken);
        return boxes.Count > 0
            && boxes.All(s => s is SampleBoxStatus.Received or SampleBoxStatus.Completed);
    }

    private static SampleBoxSummaryDto MapSummary(SampleBox box) =>
        new(
            box.Id,
            box.CollectionBatchId,
            box.BoxNumber,
            box.Status,
            box.LotCount,
            box.BagCount,
            box.NetWeightKg,
            box.WarehouseOrBasis,
            box.CollectorName,
            box.CreatedAt,
            box.PrintedAt,
            box.PrintCount,
            box.ReceivedAt,
            box.ReceivedBy);

    private static SampleBoxDetailDto MapDetail(SampleBox box)
    {
        var batch = box.CollectionBatch;
        return new SampleBoxDetailDto(
            box.Id,
            box.CollectionBatchId,
            box.BoxNumber,
            box.Status,
            box.LotCount,
            box.BagCount,
            box.NetWeightKg,
            box.WarehouseOrBasis,
            box.CollectorName,
            box.Remarks,
            box.CreatedAt,
            box.PrintedAt,
            box.PrintCount,
            box.ReceivedAt,
            box.ReceivedBy,
            batch?.SaleNumber ?? "",
            batch?.Year ?? 0,
            batch?.SaleDate ?? default,
            batch?.Centre ?? AuctionCentre.Colombo,
            box.Lots
                .OrderBy(l => l.Broker)
                .ThenBy(l => l.LotNumber)
                .Select(l => new SampleBoxLotDto(
                    l.Id,
                    l.Broker,
                    l.LotNumber,
                    l.SellingMark,
                    l.SellerName,
                    l.InvoiceNumber,
                    l.Grade,
                    l.Bags,
                    l.NetWeightKg,
                    l.WarehouseOrBasis,
                    l.BuyerCode,
                    l.BuyerName))
                .ToList());
    }
}
