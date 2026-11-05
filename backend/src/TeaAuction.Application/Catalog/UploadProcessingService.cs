using FluentValidation;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TeaAuction.Application.Abstractions;
using TeaAuction.Domain;

namespace TeaAuction.Application.Catalog;

public sealed class UploadProcessingService(
    ISaleRepository sales,
    IUploadBatchRepository uploads,
    IUnitOfWork unitOfWork,
    ILotCsvParser csvParser,
    IBrokerCatalogueParser brokerParser,
    ISalesResultParser salesParser,
    IValidator<LotCsvRow> rowValidator,
    IFileStore files,
    IEmailSender email,
    IOptions<NotificationOptions> notifications,
    ILogger<UploadProcessingService> logger)
{
    public async Task ProcessAsync(Guid uploadBatchId, CancellationToken cancellationToken)
    {
        var batch = await uploads.GetTrackedAsync(uploadBatchId, cancellationToken)
            ?? throw new InvalidOperationException($"Upload {uploadBatchId} was not found.");

        if (batch.Status == UploadStatus.Completed)
            return;

        batch.Status = UploadStatus.Processing;
        batch.Error = null;
        await unitOfWork.SaveChangesAsync(cancellationToken);

        try
        {
            if (batch.Kind == UploadKind.PostAuctionSales)
                await ImportSalesAsync(batch, cancellationToken);
            else
                await ImportCatalogueAsync(batch, cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Upload {UploadId} failed unexpectedly", uploadBatchId);
            await uploads.MarkFailedAsync(uploadBatchId, exception.Message, cancellationToken);
            throw;
        }
    }

    private async Task ImportCatalogueAsync(UploadBatch batch, CancellationToken cancellationToken)
    {
        await using var stream = await files.OpenReadAsync(batch.StorageKey, cancellationToken);
        var parsed = CatalogueFileKinds.IsCsv(batch.OriginalFileName)
            ? csvParser.Parse(stream)
            : brokerParser.Parse(batch.Broker, stream);

        if (parsed.Errors.Count > 0)
        {
            await FailAsync(batch, string.Join(" ", parsed.Errors), cancellationToken);
            return;
        }

        var rowErrors = new List<string>();
        foreach (var row in parsed.Rows)
        {
            var validation = await rowValidator.ValidateAsync(row, cancellationToken);
            foreach (var error in validation.Errors)
                rowErrors.Add($"Line {row.LineNumber}: {error.ErrorMessage}");
        }

        if (rowErrors.Count > 0)
        {
            await FailAsync(batch, string.Join(" ", rowErrors.Take(20)), cancellationToken);
            return;
        }

        var sale = await EnsureSaleAsync(batch, cancellationToken);
        if (sale is null)
            return;

        var numbers = parsed.Rows.Select(row => row.LotNumber).ToArray();
        var existing = await sales.FindExistingLotNumbersAsync(sale.Id, batch.Broker, numbers, cancellationToken);
        if (existing.Count > 0)
        {
            await FailAsync(
                batch,
                $"Lot numbers already on this sale for {batch.Broker}: {string.Join(", ", existing.Order().Take(20))}.",
                cancellationToken);
            return;
        }

        foreach (var row in parsed.Rows)
        {
            sales.AddLot(new Lot
            {
                Id = Guid.CreateVersion7(),
                SaleId = sale.Id,
                UploadBatchId = batch.Id,
                Broker = batch.Broker,
                LotNumber = row.LotNumber,
                FactoryCode = row.FactoryCode.Trim(),
                GardenMark = row.GardenMark.Trim(),
                InvoiceNumber = row.InvoiceNumber.Trim(),
                Grade = row.Grade.Trim(),
                Bags = row.Bags,
                PackageType = row.PackageType.Trim(),
                NetPerBagKg = row.NetPerBagKg,
                NetWeightKg = row.NetWeightKg,
                SellingMark = row.SellingMark.Trim(),
                WarehouseOrBasis = row.WarehouseOrBasis.Trim(),
                Category = row.Category.Trim(),
                ValuationPerKg = row.ValuationPerKg,
                BuyerCode = "",
                SourceLine = Truncate(row.SourceLine.Trim(), 400)
            });
        }

        await CompleteAsync(batch, sale.Id, parsed.Rows.Count, cancellationToken);
        logger.LogInformation(
            "Accepted {LotCount} {Broker} catalogue lots for {Centre} sale {SaleNumber}/{Year} from upload {UploadId}",
            batch.LotCount,
            batch.Broker,
            batch.Centre,
            batch.SaleNumber,
            batch.Year,
            batch.Id);
    }

    private async Task ImportSalesAsync(UploadBatch batch, CancellationToken cancellationToken)
    {
        await using var stream = await files.OpenReadAsync(batch.StorageKey, cancellationToken);
        var parsed = salesParser.Parse(batch.Broker, batch.OriginalFileName, stream);
        if (parsed.Rows.Count == 0)
        {
            await FailAsync(
                batch,
                parsed.Errors.Count > 0
                    ? string.Join(" ", parsed.Errors.Take(20))
                    : "No post-auction sales rows could be read.",
                cancellationToken);
            return;
        }

        var sale = await sales.FindByKeyAsync(batch.Centre, batch.Year, batch.SaleNumber, cancellationToken);
        if (sale is null)
        {
            await FailAsync(
                batch,
                $"No pre-auction catalogue exists for {batch.Centre} sale {batch.SaleNumber}/{batch.Year}. Upload catalogues first.",
                cancellationToken);
            return;
        }

        if (sale.SaleDate != batch.SaleDate)
        {
            await FailAsync(
                batch,
                $"Sale {batch.SaleNumber}/{batch.Year} at {batch.Centre} is on {sale.SaleDate:yyyy-MM-dd}, not {batch.SaleDate:yyyy-MM-dd}.",
                cancellationToken);
            return;
        }

        // Same lot may appear with different prices/values — last row already wins in the parser.
        var numbers = parsed.Rows.Select(row => row.LotNumber).Distinct().ToArray();
        var lots = await sales.FindTrackedLotsAsync(sale.Id, batch.Broker, numbers, cancellationToken);
        var byNumber = lots.ToDictionary(lot => lot.LotNumber);

        var applied = 0;
        foreach (var row in parsed.Rows)
        {
            if (!byNumber.TryGetValue(row.LotNumber, out var lot))
            {
                // Sales files can arrive before / without a successful catalogue import for a broker.
                lot = new Lot
                {
                    Id = Guid.CreateVersion7(),
                    SaleId = sale.Id,
                    Broker = batch.Broker,
                    LotNumber = row.LotNumber,
                    FactoryCode = "",
                    GardenMark = row.GardenMark ?? "",
                    InvoiceNumber = "",
                    Grade = row.Grade ?? "",
                    Bags = 0,
                    PackageType = "",
                    NetWeightKg = row.NetWeightKg ?? 0,
                    SellingMark = "",
                    WarehouseOrBasis = "",
                    Category = "",
                    SourceLine = row.SourceLine
                };
                sales.AddLot(lot);
                byNumber[row.LotNumber] = lot;
            }

            lot.SoldPricePerKg = row.SoldPricePerKg;
            lot.BuyerCode = string.IsNullOrWhiteSpace(row.BuyerCode) ? "" : row.BuyerCode.Trim();
            lot.SalesUploadBatchId = batch.Id;
            if (string.IsNullOrWhiteSpace(lot.GardenMark) && !string.IsNullOrWhiteSpace(row.GardenMark))
                lot.GardenMark = row.GardenMark;
            if (string.IsNullOrWhiteSpace(lot.Grade) && !string.IsNullOrWhiteSpace(row.Grade))
                lot.Grade = row.Grade;
            if (lot.NetWeightKg == 0 && row.NetWeightKg is > 0)
                lot.NetWeightKg = row.NetWeightKg.Value;
            if (string.IsNullOrWhiteSpace(lot.SourceLine))
                lot.SourceLine = row.SourceLine;
            applied++;
        }

        await CompleteAsync(batch, sale.Id, applied, cancellationToken);
        logger.LogInformation(
            "Applied {LotCount} of {ParsedCount} {Broker} post-auction sales rows for {Centre} sale {SaleNumber}/{Year} from upload {UploadId}",
            batch.LotCount,
            parsed.Rows.Count,
            batch.Broker,
            batch.Centre,
            batch.SaleNumber,
            batch.Year,
            batch.Id);
    }

    private async Task<Sale?> EnsureSaleAsync(UploadBatch batch, CancellationToken cancellationToken)
    {
        var sale = await sales.FindByKeyAsync(batch.Centre, batch.Year, batch.SaleNumber, cancellationToken);
        if (sale is null)
        {
            sale = new Sale
            {
                Id = Guid.CreateVersion7(),
                SaleNumber = batch.SaleNumber,
                Year = batch.Year,
                Centre = batch.Centre,
                SaleDate = batch.SaleDate,
                Status = SaleStatus.Open,
                CreatedAt = DateTimeOffset.UtcNow
            };
            await sales.AddAsync(sale, cancellationToken);
            return sale;
        }

        if (sale.SaleDate != batch.SaleDate)
        {
            await FailAsync(
                batch,
                $"Sale {batch.SaleNumber}/{batch.Year} at {batch.Centre} already exists on {sale.SaleDate:yyyy-MM-dd}.",
                cancellationToken);
            return null;
        }

        return sale;
    }

    private async Task CompleteAsync(UploadBatch batch, Guid saleId, int lotCount, CancellationToken cancellationToken)
    {
        batch.SaleId = saleId;
        batch.LotCount = lotCount;
        batch.Status = UploadStatus.Completed;
        batch.ProcessedAt = DateTimeOffset.UtcNow;
        batch.Error = null;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await TryEmailAsync(batch, cancellationToken);
    }

    private async Task FailAsync(UploadBatch batch, string error, CancellationToken cancellationToken)
    {
        batch.Status = UploadStatus.Failed;
        batch.Error = Truncate(error);
        batch.ProcessedAt = DateTimeOffset.UtcNow;
        batch.LotCount = 0;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await TryEmailAsync(batch, cancellationToken);
        logger.LogWarning("Rejected upload {UploadId}: {Error}", batch.Id, batch.Error);
    }

    private async Task TryEmailAsync(UploadBatch batch, CancellationToken cancellationToken)
    {
        var to = notifications.Value.OperatorEmail?.Trim();
        if (string.IsNullOrWhiteSpace(to))
            return;

        var kind = batch.Kind == UploadKind.PostAuctionSales ? "Sales" : "Catalogue";
        var subject = $"{kind} upload {batch.Status}: {batch.Broker} {batch.Centre} sale {batch.SaleNumber}/{batch.Year}";
        var body = batch.Status == UploadStatus.Completed
            ? $"Accepted {batch.LotCount} rows from {batch.OriginalFileName}."
            : $"Rejected {batch.OriginalFileName}. {batch.Error}";

        try
        {
            await email.SendAsync(new EmailMessage(to, subject, body), cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Result email for upload {UploadId} was not sent", batch.Id);
        }
    }

    private static string Truncate(string value, int max = 2000) =>
        value.Length <= max ? value : value[..max];
}
