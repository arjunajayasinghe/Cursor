using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Application.Abstractions;

public interface IBlendRepository
{
    Task<IReadOnlyList<BlendSheetSummaryDto>> ListAsync(BlendSheetStatus? status, CancellationToken cancellationToken);

    Task<BlendSheetDetailDto?> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<BlendSheet?> GetTrackedAsync(Guid id, CancellationToken cancellationToken);

    Task AddAsync(BlendSheet sheet, CancellationToken cancellationToken);

    Task<string> AllocateBlendNumberAsync(int year, CancellationToken cancellationToken);

    Task<IReadOnlyList<BlendInventoryLotDto>> ListCollectedInventoryAsync(
        Guid? excludeBlendSheetId,
        string? saleNumber,
        string? broker,
        string? grade,
        string? estate,
        CancellationToken cancellationToken);

    Task<Dictionary<Guid, CollectionLot>> GetCollectedLotsAsync(
        IReadOnlyCollection<Guid> collectionLotIds,
        CancellationToken cancellationToken);

    Task<Dictionary<Guid, decimal>> GetReservedByLotAsync(
        Guid? excludeBlendSheetId,
        CancellationToken cancellationToken);

    Task RemoveLinesAndReservationsAsync(Guid blendSheetId, CancellationToken cancellationToken);
}
