using TeaAuction.Domain;

namespace TeaAuction.Application.Catalog;

public sealed record PurchasedInvoiceLotRow(
    int LotNumber,
    string SellingMark,
    string InvoiceNumber,
    string Grade,
    int Bags,
    decimal? NetPerBagKg,
    decimal NetWeightKg,
    decimal SoldPricePerKg,
    decimal Proceeds,
    decimal VatAmount,
    decimal ProceedsWithVat);

public sealed record PurchasedInvoiceParseResult(
    string BuyerCode,
    string BuyerName,
    string ContractNo,
    DateOnly? SaleDate,
    string? SaleNumberFromContract,
    int? YearFromContract,
    decimal? TotalNetKg,
    decimal? TotalProceeds,
    decimal? TotalVat,
    decimal? TotalPayable,
    IReadOnlyList<PurchasedInvoiceLotRow> Lots,
    IReadOnlyList<string> Errors);

public sealed record CreatePurchasedInvoiceCommand(
    string SaleNumber,
    int Year,
    string Centre,
    DateOnly SaleDate,
    string Broker,
    string FileName,
    long Length);

public interface IPurchasedInvoicePdfParser
{
    PurchasedInvoiceParseResult Parse(BrokerCode broker, Stream content);
}
