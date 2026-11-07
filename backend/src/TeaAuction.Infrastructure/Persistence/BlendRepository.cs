using Microsoft.EntityFrameworkCore;
using TeaAuction.Application.Abstractions;
using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Infrastructure.Persistence;

public sealed class BlendRepository(TeaAuctionDbContext db) : IBlendRepository
{
    public const string BlendSeriesCode = "BLEND_SHEET";

    private static readonly InventoryReservationStatus[] ActiveReservationStatuses =
    [
        InventoryReservationStatus.Temp,
        InventoryReservationStatus.Active,
        InventoryReservationStatus.Approved,
        InventoryReservationStatus.PartiallyConsumed
    ];

    public async Task<IReadOnlyList<BlendSheetSummaryDto>> ListAsync(
        BlendSheetStatus? status,
        CancellationToken cancellationToken)
    {
        var q = db.BlendSheets.AsNoTracking().AsQueryable();
        if (status is not null)
            q = q.Where(x => x.Status == status);
        var rows = await q.OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken);
        return rows.Select(MapSummary).ToList();
    }

    public async Task<BlendSheetDetailDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var sheet = await db.BlendSheets
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return sheet is null ? null : MapDetail(sheet);
    }

    public Task<BlendSheet?> GetTrackedAsync(Guid id, CancellationToken cancellationToken) =>
        db.BlendSheets
            .Include(x => x.Lines)
            .Include(x => x.Reservations)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task AddAsync(BlendSheet sheet, CancellationToken cancellationToken)
    {
        db.BlendSheets.Add(sheet);
        return Task.CompletedTask;
    }

    public async Task<string> AllocateBlendNumberAsync(int year, CancellationToken cancellationToken)
    {
        var series = await db.NumberSeries
            .FirstOrDefaultAsync(x => x.Code == BlendSeriesCode && x.Year == year, cancellationToken);
        if (series is null)
        {
            series = new NumberSeries
            {
                Id = Guid.CreateVersion7(),
                Code = BlendSeriesCode,
                Prefix = "BLD",
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

    public async Task<Dictionary<Guid, decimal>> GetReservedByLotAsync(
        Guid? excludeBlendSheetId,
        CancellationToken cancellationToken)
    {
        var q = db.InventoryReservations.AsNoTracking()
            .Where(r => ActiveReservationStatuses.Contains(r.Status));
        if (excludeBlendSheetId is not null)
            q = q.Where(r => r.BlendSheetId != excludeBlendSheetId.Value);

        var rows = await q
            .GroupBy(r => r.CollectionLotId)
            .Select(g => new
            {
                LotId = g.Key,
                Qty = g.Sum(r => r.ReservedQuantityKg - r.ConsumedQuantityKg - r.ReleasedQuantityKg)
            })
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(x => x.LotId, x => x.Qty < 0 ? 0 : x.Qty);
    }

    public async Task<IReadOnlyList<BlendInventoryLotDto>> ListCollectedInventoryAsync(
        Guid? excludeBlendSheetId,
        string? saleNumber,
        string? broker,
        string? grade,
        string? estate,
        CancellationToken cancellationToken)
    {
        var reserved = await GetReservedByLotAsync(excludeBlendSheetId, cancellationToken);

        var q = db.CollectionLots
            .AsNoTracking()
            .Include(l => l.SampleBox)
            .Include(l => l.CollectionBatch)
            .Where(l => l.SampleBoxId != null)
            .Where(l => l.SampleBox!.Status == SampleBoxStatus.Received
                        || l.SampleBox!.Status == SampleBoxStatus.Completed);

        if (!string.IsNullOrWhiteSpace(saleNumber))
        {
            var sn = saleNumber.Trim();
            q = q.Where(l => l.CollectionBatch!.SaleNumber == sn
                             || l.CollectionBatch.SaleNumber.TrimStart('0') == sn.TrimStart('0'));
        }

        if (!string.IsNullOrWhiteSpace(broker)
            && Enum.TryParse<BrokerCode>(broker.Trim(), true, out var brokerCode))
        {
            q = q.Where(l => l.Broker == brokerCode);
        }

        if (!string.IsNullOrWhiteSpace(grade))
        {
            var g = grade.Trim().ToLower();
            q = q.Where(l => l.Grade.ToLower().Contains(g));
        }

        if (!string.IsNullOrWhiteSpace(estate))
        {
            var e = estate.Trim().ToLower();
            q = q.Where(l =>
                l.SellerName.ToLower().Contains(e)
                || l.SellingMark.ToLower().Contains(e)
                || l.GardenMark.ToLower().Contains(e));
        }

        var lots = await q
            .OrderBy(l => l.CollectionBatch!.Year)
            .ThenBy(l => l.CollectionBatch!.SaleNumber)
            .ThenBy(l => l.Broker)
            .ThenBy(l => l.LotNumber)
            .Take(500)
            .ToListAsync(cancellationToken);

        return lots.Select(l =>
        {
            var physical = l.NetWeightKg;
            reserved.TryGetValue(l.Id, out var resQty);
            var available = physical - resQty;
            if (available < 0) available = 0;
            var cost = l.SoldPricePerKg;
            return new BlendInventoryLotDto(
                l.Id,
                l.SampleBoxId,
                l.SampleBox?.BoxNumber,
                l.CollectionBatch?.SaleNumber ?? "",
                l.CollectionBatch?.Year ?? 0,
                l.Broker,
                l.LotNumber,
                l.SellingMark,
                l.GardenMark,
                string.IsNullOrWhiteSpace(l.SellerName) ? l.GardenMark : l.SellerName,
                l.Grade,
                l.WarehouseOrBasis,
                l.NetWeightKg,
                physical,
                resQty,
                available,
                cost,
                "Approved",
                cost > 0);
        }).Where(x => x.AvailableQtyKg > 0).ToList();
    }

    public async Task<Dictionary<Guid, CollectionLot>> GetCollectedLotsAsync(
        IReadOnlyCollection<Guid> collectionLotIds,
        CancellationToken cancellationToken)
    {
        if (collectionLotIds.Count == 0) return new Dictionary<Guid, CollectionLot>();
        var lots = await db.CollectionLots
            .Include(l => l.SampleBox)
            .Include(l => l.CollectionBatch)
            .Where(l => collectionLotIds.Contains(l.Id))
            .ToListAsync(cancellationToken);
        return lots.ToDictionary(l => l.Id);
    }

    public async Task RemoveLinesAndReservationsAsync(Guid blendSheetId, CancellationToken cancellationToken)
    {
        var lines = await db.BlendSheetLines.Where(x => x.BlendSheetId == blendSheetId).ToListAsync(cancellationToken);
        var reservations = await db.InventoryReservations.Where(x => x.BlendSheetId == blendSheetId).ToListAsync(cancellationToken);
        db.BlendSheetLines.RemoveRange(lines);
        db.InventoryReservations.RemoveRange(reservations);
        await Task.CompletedTask;
    }

    private static BlendSheetSummaryDto MapSummary(BlendSheet s) =>
        new(
            s.Id,
            s.BlendNumber,
            s.BlendDate,
            s.SalesOrderRef,
            s.CustomerName,
            s.ProductName,
            s.TargetQuantityKg,
            s.TargetPricePerKg,
            s.Currency,
            s.TargetTeaCostPerKg,
            s.PreparedBy,
            s.Status,
            s.AllocatedQuantityKg,
            s.TotalRawTeaCost,
            s.WeightedAverageCostPerKg,
            string.IsNullOrWhiteSpace(s.ActiveOptionKey) ? "A" : s.ActiveOptionKey,
            s.CreatedAt,
            s.ConfirmedAt);

    internal static BlendSheetDetailDto MapDetail(BlendSheet s)
    {
        var activeKey = string.IsNullOrWhiteSpace(s.ActiveOptionKey) ? "A" : s.ActiveOptionKey.Trim().ToUpperInvariant();
        var options = BuildOptions(s, activeKey);
        var active = options.FirstOrDefault(o => o.Key == activeKey) ?? options.FirstOrDefault();
        var lines = active?.Lines ?? Array.Empty<BlendSheetLineDto>();
        var remaining = s.TargetQuantityKg - s.AllocatedQuantityKg;
        var sellingValue = s.TargetPricePerKg is null ? (decimal?)null : s.TargetPricePerKg * s.AllocatedQuantityKg;
        var spread = sellingValue is null ? null : sellingValue - s.TotalRawTeaCost;
        var warnings = BuildWarnings(s, lines);

        return new BlendSheetDetailDto(
            s.Id,
            s.BlendNumber,
            s.BlendDate,
            s.SalesOrderRef,
            s.CustomerName,
            s.ProductName,
            s.TargetQuantityKg,
            s.TargetPricePerKg,
            s.Currency,
            s.TargetTeaCostPerKg,
            s.PreparedBy,
            s.Status,
            s.Remarks,
            s.AllocatedQuantityKg,
            s.TotalRawTeaCost,
            s.WeightedAverageCostPerKg,
            remaining,
            sellingValue,
            spread,
            activeKey,
            s.Version,
            s.CreatedAt,
            s.UpdatedAt,
            s.ConfirmedAt,
            lines,
            options,
            warnings);
    }

    private static IReadOnlyList<BlendOptionDto> BuildOptions(BlendSheet s, string activeKey)
    {
        var keys = s.Lines
            .Select(l => string.IsNullOrWhiteSpace(l.OptionKey) ? "A" : l.OptionKey.Trim().ToUpperInvariant())
            .Distinct()
            .OrderBy(k => k)
            .ToList();
        if (keys.Count == 0)
            keys.Add(activeKey);

        if (!keys.Contains(activeKey))
            keys.Insert(0, activeKey);

        return keys.Select(key =>
        {
            var optionLines = s.Lines
                .Where(l => (string.IsNullOrWhiteSpace(l.OptionKey) ? "A" : l.OptionKey.Trim().ToUpperInvariant()) == key)
                .OrderBy(l => l.Year)
                .ThenBy(l => l.SaleNumber)
                .ThenBy(l => l.Broker)
                .ThenBy(l => l.LotNumber)
                .ToList();
            var allocated = optionLines.Sum(l => l.AllocatedQtyKg);
            var cost = optionLines.Sum(l => l.AllocatedQtyKg * l.UnitCostPerKg);
            var wavg = allocated > 0 ? Math.Round(cost / allocated, 4) : (decimal?)null;
            var remaining = s.TargetQuantityKg - allocated;
            var selling = s.TargetPricePerKg is null ? (decimal?)null : s.TargetPricePerKg * allocated;
            var spread = selling is null ? null : selling - cost;
            var variance = s.TargetPricePerKg is null || wavg is null ? null : wavg - s.TargetPricePerKg;
            var dtos = optionLines.Select(l => new BlendSheetLineDto(
                l.Id,
                l.CollectionLotId,
                l.SampleBoxId,
                l.SaleNumber,
                l.Year,
                l.Broker,
                l.LotNumber,
                l.Estate,
                l.Grade,
                l.WarehouseOrBasis,
                l.PurchasedQtyKg,
                l.PhysicalStockKg,
                l.AllocatedQtyKg,
                l.UnitCostPerKg,
                l.QualityStatus,
                l.LineCost,
                allocated > 0 ? Math.Round(l.AllocatedQtyKg / allocated * 100m, 2) : 0,
                key)).ToList();
            return new BlendOptionDto(
                key,
                $"Option {key}",
                allocated,
                cost,
                wavg,
                remaining,
                spread,
                variance,
                dtos);
        }).ToList();
    }

    private static IReadOnlyList<string> BuildWarnings(BlendSheet s, IReadOnlyList<BlendSheetLineDto> lines)
    {
        var warnings = new List<string>();
        if (s.TargetQuantityKg > 0 && Math.Abs(s.AllocatedQuantityKg - s.TargetQuantityKg) > 0.001m)
            warnings.Add($"Allocated {s.AllocatedQuantityKg:0.###} kg differs from target {s.TargetQuantityKg:0.###} kg.");
        if (lines.Any(l => !string.Equals(l.QualityStatus, "Approved", StringComparison.OrdinalIgnoreCase)))
            warnings.Add("One or more lots are not quality-approved.");
        if (lines.Any(l => l.UnitCostPerKg <= 0))
            warnings.Add("One or more lots have missing or unverified inventory cost.");
        if (s.TargetTeaCostPerKg is not null
            && s.WeightedAverageCostPerKg is not null
            && s.WeightedAverageCostPerKg > s.TargetTeaCostPerKg)
            warnings.Add($"Weighted average cost {s.WeightedAverageCostPerKg:0.####} exceeds target tea cost {s.TargetTeaCostPerKg:0.####}.");
        return warnings;
    }
}
