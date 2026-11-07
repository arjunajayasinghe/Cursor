using FluentValidation;
using TeaAuction.Application.Abstractions;
using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Application.Catalog;

public sealed class UploadService(
    IValidator<CreateUploadCommand> validator,
    IFileStore files,
    IUploadBatchRepository uploads,
    IUnitOfWork unitOfWork,
    IUploadJobScheduler scheduler)
{
    public async Task<OperationResult<UploadAcceptedDto>> CreateAsync(
        CreateUploadCommand command,
        Stream content,
        CancellationToken cancellationToken)
    {
        command = command with
        {
            SaleNumber = command.SaleNumber.Trim(),
            Centre = command.Centre.Trim(),
            Broker = command.Broker.Trim().ToUpperInvariant(),
            Kind = string.IsNullOrWhiteSpace(command.Kind) ? nameof(UploadKind.PreAuctionCatalogue) : command.Kind.Trim(),
            FileName = Path.GetFileName(command.FileName.Trim())
        };

        var validation = await validator.ValidateAsync(command, cancellationToken);
        if (!validation.IsValid)
            return OperationResult<UploadAcceptedDto>.Fail(validation.Errors.Select(error => error.ErrorMessage));

        if (!Enum.TryParse<AuctionCentre>(command.Centre, ignoreCase: true, out var centre))
            return OperationResult<UploadAcceptedDto>.Fail(["Centre is not recognised."]);

        if (!Enum.TryParse<BrokerCode>(command.Broker, ignoreCase: true, out var broker))
            return OperationResult<UploadAcceptedDto>.Fail(["Broker is not recognised."]);

        if (!Enum.TryParse<UploadKind>(command.Kind, ignoreCase: true, out var kind))
            return OperationResult<UploadAcceptedDto>.Fail(["Upload kind is not recognised."]);

        var contentType = CatalogueFileKinds.IsExcel(command.FileName)
            ? "application/vnd.ms-excel"
            : CatalogueFileKinds.IsCsv(command.FileName) ? "text/csv" : "text/plain";
        var storageKey = await files.SaveAsync(command.FileName, content, contentType, cancellationToken);
        var batch = new UploadBatch
        {
            Id = Guid.CreateVersion7(),
            SaleNumber = command.SaleNumber,
            Year = command.Year,
            Centre = centre,
            SaleDate = command.SaleDate,
            Broker = broker,
            Kind = kind,
            OriginalFileName = command.FileName,
            StorageKey = storageKey,
            ContentType = contentType,
            Status = UploadStatus.Pending,
            CreatedAt = DateTimeOffset.UtcNow
        };

        await uploads.AddAsync(batch, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        scheduler.EnqueueProcessUpload(batch.Id);

        return OperationResult<UploadAcceptedDto>.Ok(new UploadAcceptedDto(batch.Id, batch.Status, batch.SaleId));
    }

    /// <summary>
    /// Re-queues a failed (or previously completed) catalogue/sales upload so repaired parsers
    /// can fill missing lots without wiping the sale.
    /// </summary>
    public async Task<OperationResult<UploadAcceptedDto>> ReprocessAsync(Guid uploadBatchId, CancellationToken cancellationToken)
    {
        var batch = await uploads.GetTrackedAsync(uploadBatchId, cancellationToken);
        if (batch is null)
            return OperationResult<UploadAcceptedDto>.Fail(["Upload was not found."]);

        batch.Status = UploadStatus.Pending;
        batch.Error = null;
        batch.ProcessedAt = null;
        batch.LotCount = 0;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        scheduler.EnqueueProcessUpload(batch.Id);
        return OperationResult<UploadAcceptedDto>.Ok(new UploadAcceptedDto(batch.Id, batch.Status, batch.SaleId));
    }
}
