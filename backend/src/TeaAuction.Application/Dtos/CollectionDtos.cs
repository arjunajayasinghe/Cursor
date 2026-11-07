using TeaAuction.Domain;

namespace TeaAuction.Application.Dtos;

public sealed record CollectionBatchSummaryDto(
    Guid Id,
    Guid? SaleId,
    string SaleNumber,
    int Year,
    AuctionCentre Centre,
    DateOnly SaleDate,
    string Name,
    CollectionBatchStatus Status,
    int LotCount,
    int BagCount,
    decimal NetWeightKg,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);

public sealed record CollectionLotDto(
    Guid Id,
    Guid CollectionBatchId,
    Guid? PurchasedInvoiceLotId,
    BrokerCode Broker,
    int LotNumber,
    string SellingMark,
    string SellerName,
    string SellerVatNo,
    string InvoiceNumber,
    string Grade,
    int Bags,
    decimal? NetPerBagKg,
    decimal NetWeightKg,
    decimal SoldPricePerKg,
    decimal Proceeds,
    decimal VatAmount,
    decimal ProceedsWithVat,
    string WarehouseOrBasis,
    string BuyerCode,
    string BuyerName,
    string GardenMark,
    DateTimeOffset SelectedAt,
    Guid? SampleBoxId,
    string? BoxNumber);

public sealed record CollectionBatchDetailDto(
    Guid Id,
    Guid? SaleId,
    string SaleNumber,
    int Year,
    AuctionCentre Centre,
    DateOnly SaleDate,
    string Name,
    CollectionBatchStatus Status,
    int LotCount,
    int BagCount,
    decimal NetWeightKg,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    IReadOnlyList<CollectionLotDto> Lots);

public sealed record SelectCollectionLotsRequest(
    string SaleNumber,
    int Year,
    string? Name,
    IReadOnlyList<Guid> PurchasedInvoiceLotIds);
