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
    string Estate,
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
    decimal Percentage);

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
    int Version,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    DateTimeOffset? ConfirmedAt,
    IReadOnlyList<BlendSheetLineDto> Lines,
    IReadOnlyList<string> Warnings);

public sealed record BlendLineInputDto(
    Guid CollectionLotId,
    decimal AllocatedQtyKg);

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
    IReadOnlyList<BlendLineInputDto> Lines);

public sealed record ConfirmBlendSheetRequest(
    Guid Id);
