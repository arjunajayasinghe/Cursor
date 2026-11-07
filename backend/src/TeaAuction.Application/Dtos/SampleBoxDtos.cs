using TeaAuction.Domain;

namespace TeaAuction.Application.Dtos;

public sealed record SampleBoxLotDto(
    Guid CollectionLotId,
    BrokerCode Broker,
    int LotNumber,
    string SellingMark,
    string SellerName,
    string InvoiceNumber,
    string Grade,
    int Bags,
    decimal NetWeightKg,
    string WarehouseOrBasis,
    string BuyerCode,
    string BuyerName);

public sealed record SampleBoxSummaryDto(
    Guid Id,
    Guid CollectionBatchId,
    string BoxNumber,
    SampleBoxStatus Status,
    int LotCount,
    int BagCount,
    decimal NetWeightKg,
    string WarehouseOrBasis,
    string? CollectorName,
    DateTimeOffset CreatedAt,
    DateTimeOffset? PrintedAt,
    int PrintCount,
    DateTimeOffset? ReceivedAt,
    string? ReceivedBy);

public sealed record SampleBoxDetailDto(
    Guid Id,
    Guid CollectionBatchId,
    string BoxNumber,
    SampleBoxStatus Status,
    int LotCount,
    int BagCount,
    decimal NetWeightKg,
    string WarehouseOrBasis,
    string? CollectorName,
    string? Remarks,
    DateTimeOffset CreatedAt,
    DateTimeOffset? PrintedAt,
    int PrintCount,
    DateTimeOffset? ReceivedAt,
    string? ReceivedBy,
    string SaleNumber,
    int Year,
    DateOnly SaleDate,
    AuctionCentre Centre,
    IReadOnlyList<SampleBoxLotDto> Lots);

public sealed record GenerateSampleBoxesRequest(
    Guid CollectionBatchId,
    IReadOnlyList<Guid> CollectionLotIds,
    /// <summary>shared = one box for all selected lots; perLot = one box each.</summary>
    string Mode,
    string? CollectorName,
    string? Remarks);

public sealed record MarkSampleBoxesReceivedRequest(
    IReadOnlyList<Guid> SampleBoxIds,
    string? ReceivedBy);

public sealed record ReverseSampleBoxesRequest(
    IReadOnlyList<Guid> SampleBoxIds,
    string? Reason);

public sealed record RecordSampleBoxPrintRequest(
    Guid SampleBoxId);
