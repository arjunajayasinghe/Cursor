using TeaAuction.Domain;

namespace TeaAuction.Application.Dtos;

public sealed record PurchasedInvoiceSummaryDto(
    Guid Id,
    Guid? SaleId,
    string SaleNumber,
    int Year,
    AuctionCentre Centre,
    DateOnly SaleDate,
    BrokerCode Broker,
    string BuyerCode,
    string BuyerName,
    string ContractNo,
    UploadStatus Status,
    string OriginalFileName,
    int LotCount,
    decimal NetWeightKg,
    decimal Proceeds,
    decimal VatAmount,
    decimal Payable,
    string? Error,
    DateTimeOffset CreatedAt);

public sealed record PurchasedInvoiceLotDto(
    Guid Id,
    BrokerCode Broker,
    int LotNumber,
    string SellingMark,
    string InvoiceNumber,
    string Grade,
    int Bags,
    decimal NetWeightKg,
    decimal SoldPricePerKg,
    decimal Proceeds,
    decimal VatAmount,
    decimal ProceedsWithVat);

public sealed record PurchasedInvoiceDetailDto(
    Guid Id,
    Guid? SaleId,
    string SaleNumber,
    int Year,
    AuctionCentre Centre,
    DateOnly SaleDate,
    BrokerCode Broker,
    string BuyerCode,
    string BuyerName,
    string ContractNo,
    UploadStatus Status,
    string OriginalFileName,
    int LotCount,
    decimal NetWeightKg,
    decimal Proceeds,
    decimal VatAmount,
    decimal Payable,
    string? Error,
    DateTimeOffset CreatedAt,
    IReadOnlyList<PurchasedInvoiceLotDto> Lots);

public sealed record PurchasedInvoiceWorkbenchDto(
    Guid? SaleId,
    string SaleNumber,
    int Year,
    DateOnly SaleDate,
    IReadOnlyList<PurchasedInvoiceSummaryDto> Invoices,
    IReadOnlyList<PurchasedInvoiceLotDto> Lots);
