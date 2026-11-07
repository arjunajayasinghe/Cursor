using Microsoft.Extensions.Logging;
using TeaAuction.Application.Abstractions;
using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Application.Catalog;

public sealed class SampleBoxService(
    ISampleBoxRepository boxes,
    IUnitOfWork unitOfWork,
    ILogger<SampleBoxService> logger)
{
    public Task<IReadOnlyList<SampleBoxSummaryDto>> ListByBatchAsync(
        Guid batchId,
        CancellationToken cancellationToken) =>
        boxes.ListByBatchAsync(batchId, cancellationToken);

    public Task<SampleBoxDetailDto?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        boxes.GetAsync(id, cancellationToken);

    public Task<bool> ReadyForBlendingAsync(Guid batchId, CancellationToken cancellationToken) =>
        boxes.BatchReadyForBlendingAsync(batchId, cancellationToken);

    public async Task<OperationResult<IReadOnlyList<SampleBoxDetailDto>>> GenerateAsync(
        GenerateSampleBoxesRequest request,
        CancellationToken cancellationToken)
    {
        if (request.CollectionLotIds is null || request.CollectionLotIds.Count == 0)
            return OperationResult<IReadOnlyList<SampleBoxDetailDto>>.Fail(["Select at least one collection lot."]);

        var mode = (request.Mode ?? "shared").Trim().ToLowerInvariant();
        if (mode is not ("shared" or "perlot"))
            return OperationResult<IReadOnlyList<SampleBoxDetailDto>>.Fail(["Mode must be 'shared' or 'perLot'."]);

        var batch = await boxes.GetTrackedBatchAsync(request.CollectionBatchId, cancellationToken);
        if (batch is null)
            return OperationResult<IReadOnlyList<SampleBoxDetailDto>>.Fail(["Collection batch not found."]);

        var ids = request.CollectionLotIds.Distinct().ToArray();
        var lots = await boxes.GetTrackedLotsAsync(batch.Id, ids, cancellationToken);
        if (lots.Count != ids.Length)
            return OperationResult<IReadOnlyList<SampleBoxDetailDto>>.Fail(["One or more lots are not in this collection batch."]);

        var alreadyBoxed = lots.Where(l => l.SampleBoxId is not null).ToList();
        if (alreadyBoxed.Count > 0)
        {
            var sample = alreadyBoxed.Take(5).Select(l => $"{l.Broker} lot {l.LotNumber}");
            return OperationResult<IReadOnlyList<SampleBoxDetailDto>>.Fail([
                $"Already have a box number — clear selection: {string.Join(", ", sample)}."
            ]);
        }

        var created = new List<SampleBox>();
        var now = DateTimeOffset.UtcNow;

        if (mode == "shared")
        {
            created.Add(await BuildBoxAsync(batch, lots, request.CollectorName, request.Remarks, now, cancellationToken));
        }
        else
        {
            foreach (var lot in lots.OrderBy(l => l.Broker).ThenBy(l => l.LotNumber))
            {
                created.Add(await BuildBoxAsync(batch, [lot], request.CollectorName, request.Remarks, now, cancellationToken));
            }
        }

        await boxes.AddBoxesAsync(created, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await boxes.RecalcBatchStatusAsync(batch.Id, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Generated {Count} sample box(es) for collection batch {BatchId} mode={Mode}",
            created.Count,
            batch.Id,
            mode);

        var details = new List<SampleBoxDetailDto>();
        foreach (var box in created)
        {
            var detail = await boxes.GetAsync(box.Id, cancellationToken);
            if (detail is not null) details.Add(detail);
        }

        return OperationResult<IReadOnlyList<SampleBoxDetailDto>>.Ok(details);
    }

    private async Task<SampleBox> BuildBoxAsync(
        CollectionBatch batch,
        IReadOnlyList<CollectionLot> lots,
        string? collectorName,
        string? remarks,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var boxNumber = await boxes.AllocateBoxNumberAsync(batch.Year, cancellationToken);
        var warehouses = lots
            .Select(l => l.WarehouseOrBasis)
            .Where(w => !string.IsNullOrWhiteSpace(w))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var box = new SampleBox
        {
            Id = Guid.CreateVersion7(),
            CollectionBatchId = batch.Id,
            BoxNumber = boxNumber,
            Status = SampleBoxStatus.Open,
            LotCount = lots.Count,
            BagCount = lots.Sum(l => l.Bags),
            NetWeightKg = lots.Sum(l => l.NetWeightKg),
            WarehouseOrBasis = warehouses.Count == 1 ? warehouses[0] : string.Join(" · ", warehouses.Take(3)),
            CollectorName = string.IsNullOrWhiteSpace(collectorName) ? null : collectorName.Trim(),
            Remarks = string.IsNullOrWhiteSpace(remarks) ? null : remarks.Trim(),
            CreatedAt = now,
            PrintCount = 0
        };

        foreach (var lot in lots)
            lot.SampleBoxId = box.Id;

        return box;
    }

    public async Task<OperationResult<SampleBoxDetailDto>> RecordPrintAsync(
        Guid boxId,
        CancellationToken cancellationToken)
    {
        var box = await boxes.GetTrackedBoxAsync(boxId, cancellationToken);
        if (box is null)
            return OperationResult<SampleBoxDetailDto>.Fail(["Sample box not found."]);
        if (box.Status == SampleBoxStatus.Cancelled)
            return OperationResult<SampleBoxDetailDto>.Fail(["Cancelled boxes cannot be printed."]);

        box.PrintCount += 1;
        box.PrintedAt = DateTimeOffset.UtcNow;
        if (box.Status == SampleBoxStatus.Open)
            box.Status = SampleBoxStatus.Printed;

        await unitOfWork.SaveChangesAsync(cancellationToken);
        await boxes.RecalcBatchStatusAsync(box.CollectionBatchId, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        var detail = await boxes.GetAsync(box.Id, cancellationToken);
        return detail is null
            ? OperationResult<SampleBoxDetailDto>.Fail(["Box printed but could not be reloaded."])
            : OperationResult<SampleBoxDetailDto>.Ok(detail);
    }

    public async Task<OperationResult<IReadOnlyList<SampleBoxSummaryDto>>> MarkReceivedAsync(
        MarkSampleBoxesReceivedRequest request,
        CancellationToken cancellationToken)
    {
        if (request.SampleBoxIds is null || request.SampleBoxIds.Count == 0)
            return OperationResult<IReadOnlyList<SampleBoxSummaryDto>>.Fail(["Select at least one sample box."]);

        var ids = request.SampleBoxIds.Distinct().ToArray();
        var tracked = await boxes.GetTrackedBoxesAsync(ids, cancellationToken);
        if (tracked.Count != ids.Length)
            return OperationResult<IReadOnlyList<SampleBoxSummaryDto>>.Fail(["One or more sample boxes were not found."]);

        var now = DateTimeOffset.UtcNow;
        var receivedBy = string.IsNullOrWhiteSpace(request.ReceivedBy) ? "desk" : request.ReceivedBy.Trim();
        Guid? batchId = null;

        foreach (var box in tracked)
        {
            if (box.Status == SampleBoxStatus.Cancelled)
                return OperationResult<IReadOnlyList<SampleBoxSummaryDto>>.Fail([$"Box {box.BoxNumber} is cancelled."]);
            if (box.Status is SampleBoxStatus.Received or SampleBoxStatus.Completed)
                continue;

            box.Status = SampleBoxStatus.Received;
            box.ReceivedAt = now;
            box.ReceivedBy = receivedBy;
            batchId = box.CollectionBatchId;
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        if (batchId is not null)
        {
            await boxes.RecalcBatchStatusAsync(batchId.Value, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        var summaries = await boxes.ListByBatchAsync(batchId ?? tracked[0].CollectionBatchId, cancellationToken);
        return OperationResult<IReadOnlyList<SampleBoxSummaryDto>>.Ok(summaries);
    }
}
