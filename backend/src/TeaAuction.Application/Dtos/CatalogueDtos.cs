using TeaAuction.Domain;

namespace TeaAuction.Application.Dtos;

public sealed record SaleSummaryDto(
    Guid Id,
    string SaleNumber,
    int Year,
    AuctionCentre Centre,
    DateOnly SaleDate,
    SaleStatus Status,
    int LotCount,
    DateTimeOffset CreatedAt);

public sealed record LotDto(
    Guid Id,
    BrokerCode Broker,
    int LotNumber,
    string GardenMark,
    string InvoiceNumber,
    string Grade,
    int Bags,
    decimal NetWeightKg,
    decimal? ValuationPerKg);

public sealed record UploadBatchDto(
    Guid Id,
    Guid? SaleId,
    string SaleNumber,
    int Year,
    AuctionCentre Centre,
    DateOnly SaleDate,
    BrokerCode Broker,
    UploadStatus Status,
    string OriginalFileName,
    int LotCount,
    string? Error,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ProcessedAt);

public sealed record SaleDetailDto(
    Guid Id,
    string SaleNumber,
    int Year,
    AuctionCentre Centre,
    DateOnly SaleDate,
    SaleStatus Status,
    DateTimeOffset CreatedAt,
    IReadOnlyList<LotDto> Lots,
    IReadOnlyList<UploadBatchDto> Uploads);

public sealed record UploadAcceptedDto(Guid Id, UploadStatus Status, Guid? SaleId);

public sealed record UploadDetailDto(
    Guid Id,
    Guid? SaleId,
    string SaleNumber,
    int Year,
    AuctionCentre Centre,
    DateOnly SaleDate,
    BrokerCode Broker,
    UploadStatus Status,
    string OriginalFileName,
    int LotCount,
    string? Error,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ProcessedAt,
    IReadOnlyList<LotDto> Lots);

public sealed record ErrorResponse(IReadOnlyList<string> Errors);
