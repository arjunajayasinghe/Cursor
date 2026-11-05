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
            await ImportAsync(batch, cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Upload {UploadId} failed unexpectedly", uploadBatchId);
            await uploads.MarkFailedAsync(uploadBatchId, exception.Message, cancellationToken);
            throw;
        }
    }

    private async Task ImportAsync(UploadBatch batch, CancellationToken cancellationToken)
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
        }
        else if (sale.SaleDate != batch.SaleDate)
        {
            await FailAsync(
                batch,
                $"Sale {batch.SaleNumber}/{batch.Year} at {batch.Centre} already exists on {sale.SaleDate:yyyy-MM-dd}.",
                cancellationToken);
            return;
        }

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
                GardenMark = row.GardenMark.Trim(),
                InvoiceNumber = row.InvoiceNumber.Trim(),
                Grade = row.Grade.Trim(),
                Bags = row.Bags,
                NetWeightKg = row.NetWeightKg,
                ValuationPerKg = row.ValuationPerKg
            });
        }

        batch.SaleId = sale.Id;
        batch.LotCount = parsed.Rows.Count;
        batch.Status = UploadStatus.Completed;
        batch.ProcessedAt = DateTimeOffset.UtcNow;
        batch.Error = null;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await TryEmailAsync(batch, cancellationToken);
        logger.LogInformation(
            "Accepted {LotCount} {Broker} lots for {Centre} sale {SaleNumber}/{Year} from upload {UploadId}",
            batch.LotCount,
            batch.Broker,
            batch.Centre,
            batch.SaleNumber,
            batch.Year,
            batch.Id);
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

        var subject = $"Catalogue upload {batch.Status}: {batch.Broker} {batch.Centre} sale {batch.SaleNumber}/{batch.Year}";
        var body = batch.Status == UploadStatus.Completed
            ? $"Accepted {batch.LotCount} lots from {batch.OriginalFileName}."
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

    private static string Truncate(string error) => error.Length <= 2000 ? error : error[..2000];
}
