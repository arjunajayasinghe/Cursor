using TeaAuction.Domain;

namespace TeaAuction.Application.Dtos;

public sealed record BlendInventoryLotDto(
    Guid CollectionLotId,
    Guid? SampleBoxId,
    string? BoxNumber,
    string SaleNumber,
    int Year,
    BrokerCode Broker,
    int LotNumber,
    /// <summary>Estate / selling mark from invoice or catalogue.</summary>
    string SellingMark,
    /// <summary>Garden mark.</summary>
    string GardenMark,
    /// <summary>Seller / estate name when available.</summary>
    string Estate,
    /// <summary>Tea type / grade.</summary>
    string Grade,
    string WarehouseOrBasis,
    decimal PurchasedQtyKg,
    decimal PhysicalStockKg,
    decimal ReservedQtyKg,
    decimal AvailableQtyKg,
    decimal UnitCostPerKg,
    string QualityStatus,
    bool CostVerified);

public sealed record BlendSheetLineDto(
    Guid Id,
    Guid CollectionLotId,
    Guid? SampleBoxId,
    string SaleNumber,
    int Year,
    BrokerCode Broker,
    int LotNumber,
    string Estate,
    string Grade,
    string WarehouseOrBasis,
    decimal PurchasedQtyKg,
    decimal PhysicalStockKg,
    decimal AllocatedQtyKg,
    decimal UnitCostPerKg,
    string QualityStatus,
    decimal LineCost,
    decimal Percentage,
    string OptionKey);

public sealed record BlendOptionDto(
    string Key,
    string Label,
    decimal AllocatedQuantityKg,
    decimal TotalRawTeaCost,
    decimal? WeightedAverageCostPerKg,
    decimal RemainingTargetQtyKg,
    decimal? EstimatedGrossSpread,
    decimal? CostVarianceVsTarget,
    IReadOnlyList<BlendSheetLineDto> Lines);

public sealed record BlendSheetSummaryDto(
    Guid Id,
    string BlendNumber,
    DateOnly BlendDate,
    string? SalesOrderRef,
    string? CustomerName,
    string ProductName,
    decimal TargetQuantityKg,
    decimal? TargetPricePerKg,
    string Currency,
    decimal? TargetTeaCostPerKg,
    string PreparedBy,
    BlendSheetStatus Status,
    decimal AllocatedQuantityKg,
    decimal TotalRawTeaCost,
    decimal? WeightedAverageCostPerKg,
    string ActiveOptionKey,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ConfirmedAt);

public sealed record BlendSheetDetailDto(
    Guid Id,
    string BlendNumber,
    DateOnly BlendDate,
    string? SalesOrderRef,
    string? CustomerName,
    string ProductName,
    decimal TargetQuantityKg,
    decimal? TargetPricePerKg,
    string Currency,
    decimal? TargetTeaCostPerKg,
    string PreparedBy,
    BlendSheetStatus Status,
    string? Remarks,
    decimal AllocatedQuantityKg,
    decimal TotalRawTeaCost,
    decimal? WeightedAverageCostPerKg,
    decimal RemainingTargetQtyKg,
    decimal? TargetSellingValue,
    decimal? EstimatedGrossSpread,
    string ActiveOptionKey,
    int Version,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    DateTimeOffset? ConfirmedAt,
    IReadOnlyList<BlendSheetLineDto> Lines,
    IReadOnlyList<BlendOptionDto> Options,
    IReadOnlyList<string> Warnings);

public sealed record BlendLineInputDto(
    Guid CollectionLotId,
    decimal AllocatedQtyKg,
    string? OptionKey = null);

public sealed record BlendOptionInputDto(
    string Key,
    string? Label,
    IReadOnlyList<BlendLineInputDto> Lines);

public sealed record SaveBlendSheetRequest(
    Guid? Id,
    string? SalesOrderRef,
    string? CustomerName,
    string ProductName,
    decimal TargetQuantityKg,
    decimal? TargetPricePerKg,
    string? Currency,
    decimal? TargetTeaCostPerKg,
    string? PreparedBy,
    string? Remarks,
    IReadOnlyList<BlendLineInputDto>? Lines,
    string? ActiveOptionKey = null,
    IReadOnlyList<BlendOptionInputDto>? Options = null);

public sealed record ConfirmBlendSheetRequest(
    Guid Id);
