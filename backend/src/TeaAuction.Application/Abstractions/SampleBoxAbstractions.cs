using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Application.Abstractions;

public interface ISampleBoxRepository
{
    Task<IReadOnlyList<SampleBoxSummaryDto>> ListByBatchAsync(Guid batchId, CancellationToken cancellationToken);

    Task<SampleBoxDetailDto?> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<CollectionBatch?> GetTrackedBatchAsync(Guid batchId, CancellationToken cancellationToken);

    Task<IReadOnlyList<CollectionLot>> GetTrackedLotsAsync(
        Guid batchId,
        IReadOnlyCollection<Guid> lotIds,
        CancellationToken cancellationToken);

    Task AddBoxesAsync(IReadOnlyList<SampleBox> boxes, CancellationToken cancellationToken);

    Task<string> AllocateBoxNumberAsync(int year, CancellationToken cancellationToken);

    Task RecalcBatchStatusAsync(Guid batchId, CancellationToken cancellationToken);

    Task<SampleBox?> GetTrackedBoxAsync(Guid id, CancellationToken cancellationToken);

    Task<IReadOnlyList<SampleBox>> GetTrackedBoxesAsync(
        IReadOnlyCollection<Guid> ids,
        CancellationToken cancellationToken);

    Task ClearLotBoxLinksAsync(IReadOnlyCollection<Guid> boxIds, CancellationToken cancellationToken);

    Task<bool> BatchReadyForBlendingAsync(Guid batchId, CancellationToken cancellationToken);
}
