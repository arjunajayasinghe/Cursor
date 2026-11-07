using Microsoft.Extensions.Logging;
using TeaAuction.Application.Abstractions;
using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Application.Catalog;

public sealed class BlendService(
    IBlendRepository blends,
    IUnitOfWork unitOfWork,
    ILogger<BlendService> logger)
{
    public Task<IReadOnlyList<BlendSheetSummaryDto>> ListAsync(
        BlendSheetStatus? status,
        CancellationToken cancellationToken) =>
        blends.ListAsync(status, cancellationToken);

    public Task<BlendSheetDetailDto?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        blends.GetAsync(id, cancellationToken);

    public Task<IReadOnlyList<BlendInventoryLotDto>> ListInventoryAsync(
        Guid? excludeBlendSheetId,
        string? saleNumber,
        string? broker,
        string? grade,
        string? estate,
        CancellationToken cancellationToken) =>
        blends.ListCollectedInventoryAsync(excludeBlendSheetId, saleNumber, broker, grade, estate, cancellationToken);

    public async Task<OperationResult<BlendSheetDetailDto>> SaveDraftAsync(
        SaveBlendSheetRequest request,
        CancellationToken cancellationToken)
    {
        var result = await UpsertAsync(request, confirm: false, cancellationToken);
        return result;
    }

    public async Task<OperationResult<BlendSheetDetailDto>> ConfirmAsync(
        ConfirmBlendSheetRequest request,
        CancellationToken cancellationToken)
    {
        var existing = await blends.GetTrackedAsync(request.Id, cancellationToken);
        if (existing is null)
            return OperationResult<BlendSheetDetailDto>.Fail(["Blend sheet not found."]);
        if (existing.Status is BlendSheetStatus.Cancelled or BlendSheetStatus.Rejected)
            return OperationResult<BlendSheetDetailDto>.Fail(["Cancelled/rejected blends cannot be confirmed."]);
        if (existing.Status == BlendSheetStatus.Confirmed)
        {
            var already = await blends.GetAsync(existing.Id, cancellationToken);
            return already is null
                ? OperationResult<BlendSheetDetailDto>.Fail(["Blend could not be reloaded."])
                : OperationResult<BlendSheetDetailDto>.Ok(already);
        }

        if (existing.Lines.Count == 0)
            return OperationResult<BlendSheetDetailDto>.Fail(["Add at least one lot allocation before confirm."]);

        if (existing.TargetQuantityKg <= 0)
            return OperationResult<BlendSheetDetailDto>.Fail(["Target / estimated quantity is required."]);

        if (Math.Abs(existing.AllocatedQuantityKg - existing.TargetQuantityKg) > 0.001m)
        {
            return OperationResult<BlendSheetDetailDto>.Fail([
                $"Allocated {existing.AllocatedQuantityKg:0.###} kg must equal estimated/target {existing.TargetQuantityKg:0.###} kg before confirm."
            ]);
        }

        // Re-validate availability excluding this sheet's own holds, then firm reservations.
        var saveRequest = new SaveBlendSheetRequest(
            existing.Id,
            existing.SalesOrderRef,
            existing.CustomerName,
            existing.ProductName,
            existing.TargetQuantityKg,
            existing.TargetPricePerKg,
            existing.Currency,
            existing.TargetTeaCostPerKg,
            existing.PreparedBy,
            existing.Remarks,
            existing.Lines.Select(l => new BlendLineInputDto(l.CollectionLotId, l.AllocatedQtyKg)).ToList());

        return await UpsertAsync(saveRequest, confirm: true, cancellationToken);
    }

    private async Task<OperationResult<BlendSheetDetailDto>> UpsertAsync(
        SaveBlendSheetRequest request,
        bool confirm,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ProductName))
            return OperationResult<BlendSheetDetailDto>.Fail(["Product / blend name is required."]);
        if (request.TargetQuantityKg < 0)
            return OperationResult<BlendSheetDetailDto>.Fail(["Target quantity cannot be negative."]);
        if (request.Lines is null)
            return OperationResult<BlendSheetDetailDto>.Fail(["Lines payload is required."]);

        var lineInputs = request.Lines
            .Where(l => l.AllocatedQtyKg > 0)
            .GroupBy(l => l.CollectionLotId)
            .Select(g => new BlendLineInputDto(g.Key, g.Sum(x => x.AllocatedQtyKg)))
            .ToList();

        foreach (var line in lineInputs)
        {
            if (line.AllocatedQtyKg <= 0)
                return OperationResult<BlendSheetDetailDto>.Fail(["Allocated quantity must be positive."]);
        }

        BlendSheet sheet;
        var now = DateTimeOffset.UtcNow;
        var year = DateTime.UtcNow.Year;

        if (request.Id is Guid existingId && existingId != Guid.Empty)
        {
            var tracked = await blends.GetTrackedAsync(existingId, cancellationToken);
            if (tracked is null)
                return OperationResult<BlendSheetDetailDto>.Fail(["Blend sheet not found."]);
            if (tracked.Status is BlendSheetStatus.Confirmed or BlendSheetStatus.Cancelled or BlendSheetStatus.Rejected)
                return OperationResult<BlendSheetDetailDto>.Fail([$"Cannot edit a {tracked.Status} blend sheet."]);
            sheet = tracked;
            sheet.Lines.Clear();
            sheet.Reservations.Clear();
        }
        else
        {
            var blendNumber = await blends.AllocateBlendNumberAsync(year, cancellationToken);
            sheet = new BlendSheet
            {
                Id = Guid.CreateVersion7(),
                BlendNumber = blendNumber,
                BlendDate = DateOnly.FromDateTime(DateTime.UtcNow),
                CreatedAt = now,
                Version = 1
            };
            await blends.AddAsync(sheet, cancellationToken);
        }

        sheet.SalesOrderRef = NullIfWhite(request.SalesOrderRef);
        sheet.CustomerName = NullIfWhite(request.CustomerName);
        sheet.ProductName = request.ProductName.Trim();
        sheet.TargetQuantityKg = request.TargetQuantityKg;
        sheet.TargetPricePerKg = request.TargetPricePerKg;
        sheet.Currency = string.IsNullOrWhiteSpace(request.Currency) ? "LKR" : request.Currency.Trim().ToUpperInvariant();
        sheet.TargetTeaCostPerKg = request.TargetTeaCostPerKg;
        sheet.PreparedBy = string.IsNullOrWhiteSpace(request.PreparedBy) ? "desk" : request.PreparedBy.Trim();
        sheet.Remarks = NullIfWhite(request.Remarks);
        sheet.UpdatedAt = now;

        var lotMap = await blends.GetCollectedLotsAsync(lineInputs.Select(l => l.CollectionLotId).ToArray(), cancellationToken);
        var reserved = await blends.GetReservedByLotAsync(sheet.Id, cancellationToken);

        var errors = new List<string>();
        var newLines = new List<BlendSheetLine>();
        var newReservations = new List<InventoryReservation>();

        foreach (var input in lineInputs)
        {
            if (!lotMap.TryGetValue(input.CollectionLotId, out var lot))
            {
                errors.Add($"Collection lot {input.CollectionLotId} was not found.");
                continue;
            }

            var boxOk = lot.SampleBox is not null
                        && lot.SampleBox.Status is SampleBoxStatus.Received or SampleBoxStatus.Completed;
            if (!boxOk)
            {
                errors.Add($"{lot.Broker} lot {lot.LotNumber} is not from a collected sample box.");
                continue;
            }

            var physical = lot.NetWeightKg;
            reserved.TryGetValue(lot.Id, out var alreadyReserved);
            var available = physical - alreadyReserved;
            if (input.AllocatedQtyKg > available + 0.0005m)
            {
                errors.Add(
                    $"Sale {lot.CollectionBatch?.SaleNumber}/{lot.CollectionBatch?.Year} {lot.Broker} lot {lot.LotNumber}: "
                    + $"allocated {input.AllocatedQtyKg:0.###} exceeds available {available:0.###} kg.");
                continue;
            }

            var unitCost = lot.SoldPricePerKg;
            newLines.Add(new BlendSheetLine
            {
                Id = Guid.CreateVersion7(),
                BlendSheetId = sheet.Id,
                CollectionLotId = lot.Id,
                SampleBoxId = lot.SampleBoxId,
                SaleNumber = lot.CollectionBatch?.SaleNumber ?? "",
                Year = lot.CollectionBatch?.Year ?? year,
                Broker = lot.Broker,
                LotNumber = lot.LotNumber,
                Estate = string.IsNullOrWhiteSpace(lot.SellerName) ? lot.GardenMark : lot.SellerName,
                Grade = lot.Grade,
                WarehouseOrBasis = lot.WarehouseOrBasis,
                PurchasedQtyKg = lot.NetWeightKg,
                PhysicalStockKg = physical,
                AllocatedQtyKg = input.AllocatedQtyKg,
                UnitCostPerKg = unitCost,
                QualityStatus = "Approved"
            });

            newReservations.Add(new InventoryReservation
            {
                Id = Guid.CreateVersion7(),
                BlendSheetId = sheet.Id,
                BlendVersion = sheet.Version,
                CollectionLotId = lot.Id,
                WarehouseOrBasis = lot.WarehouseOrBasis,
                ReservedQuantityKg = input.AllocatedQtyKg,
                ConsumedQuantityKg = 0,
                ReleasedQuantityKg = 0,
                Status = confirm ? InventoryReservationStatus.Approved : InventoryReservationStatus.Temp,
                CreatedBy = sheet.PreparedBy,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        if (errors.Count > 0)
            return OperationResult<BlendSheetDetailDto>.Fail(errors);

        foreach (var line in newLines)
            sheet.Lines.Add(line);
        foreach (var reservation in newReservations)
            sheet.Reservations.Add(reservation);

        Recalc(sheet);

        if (confirm)
        {
            if (Math.Abs(sheet.AllocatedQuantityKg - sheet.TargetQuantityKg) > 0.001m)
            {
                return OperationResult<BlendSheetDetailDto>.Fail([
                    $"Allocated {sheet.AllocatedQuantityKg:0.###} kg must equal estimated/target {sheet.TargetQuantityKg:0.###} kg."
                ]);
            }

            sheet.Status = BlendSheetStatus.Confirmed;
            sheet.ConfirmedAt = now;
        }
        else
        {
            sheet.Status = sheet.Lines.Count > 0 ? BlendSheetStatus.TempAllocated : BlendSheetStatus.Draft;
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Saved blend {BlendNumber} status={Status} lines={Lines} allocated={Qty}",
            sheet.BlendNumber,
            sheet.Status,
            sheet.Lines.Count,
            sheet.AllocatedQuantityKg);

        var detail = await blends.GetAsync(sheet.Id, cancellationToken);
        return detail is null
            ? OperationResult<BlendSheetDetailDto>.Fail(["Blend saved but could not be reloaded."])
            : OperationResult<BlendSheetDetailDto>.Ok(detail);
    }

    private static void Recalc(BlendSheet sheet)
    {
        sheet.AllocatedQuantityKg = sheet.Lines.Sum(l => l.AllocatedQtyKg);
        sheet.TotalRawTeaCost = sheet.Lines.Sum(l => l.AllocatedQtyKg * l.UnitCostPerKg);
        sheet.WeightedAverageCostPerKg = sheet.AllocatedQuantityKg > 0
            ? Math.Round(sheet.TotalRawTeaCost / sheet.AllocatedQuantityKg, 4)
            : null;
    }

    private static string? NullIfWhite(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
