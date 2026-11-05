using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Application.Mapping;

public static class SaleMapper
{
    public static SaleDetailDto ToDetail(Sale sale) => new(
        sale.Id,
        sale.SaleNumber,
        sale.Year,
        sale.Centre,
        sale.SaleDate,
        sale.Status,
        sale.CreatedAt,
        sale.Lots
            .OrderBy(lot => lot.Broker)
            .ThenBy(lot => lot.LotNumber)
            .Select(ToLot)
            .ToList(),
        sale.Uploads.OrderByDescending(upload => upload.CreatedAt).Select(ToUpload).ToList());

    public static LotDto ToLot(Lot lot) => new(
        lot.Id,
        lot.Broker,
        lot.LotNumber,
        lot.FactoryCode,
        lot.GardenMark,
        lot.InvoiceNumber,
        lot.Grade,
        lot.Bags,
        lot.PackageType,
        lot.NetPerBagKg,
        lot.NetWeightKg,
        lot.SellingMark,
        lot.WarehouseOrBasis,
        lot.Category,
        lot.ValuationPerKg,
        lot.SourceLine);

    public static UploadBatchDto ToUpload(UploadBatch batch) => new(
        batch.Id,
        batch.SaleId,
        batch.SaleNumber,
        batch.Year,
        batch.Centre,
        batch.SaleDate,
        batch.Broker,
        batch.Status,
        batch.OriginalFileName,
        batch.LotCount,
        batch.Error,
        batch.CreatedAt,
        batch.ProcessedAt);

    public static UploadDetailDto ToUploadDetail(UploadBatch batch) => new(
        batch.Id,
        batch.SaleId,
        batch.SaleNumber,
        batch.Year,
        batch.Centre,
        batch.SaleDate,
        batch.Broker,
        batch.Status,
        batch.OriginalFileName,
        batch.LotCount,
        batch.Error,
        batch.CreatedAt,
        batch.ProcessedAt,
        batch.Lots
            .OrderBy(lot => lot.LotNumber)
            .Select(ToLot)
            .ToList());
}
