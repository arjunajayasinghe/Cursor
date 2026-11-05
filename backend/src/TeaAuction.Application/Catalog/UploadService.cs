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
            FileName = Path.GetFileName(command.FileName.Trim())
        };

        var validation = await validator.ValidateAsync(command, cancellationToken);
        if (!validation.IsValid)
            return OperationResult<UploadAcceptedDto>.Fail(validation.Errors.Select(error => error.ErrorMessage));

        if (!Enum.TryParse<AuctionCentre>(command.Centre, ignoreCase: true, out var centre))
            return OperationResult<UploadAcceptedDto>.Fail(["Centre is not recognised."]);

        if (!Enum.TryParse<BrokerCode>(command.Broker, ignoreCase: true, out var broker))
            return OperationResult<UploadAcceptedDto>.Fail(["Broker is not recognised."]);

        var contentType = CatalogueFileKinds.IsCsv(command.FileName) ? "text/csv" : "text/plain";
        var storageKey = await files.SaveAsync(command.FileName, content, contentType, cancellationToken);
        var batch = new UploadBatch
        {
            Id = Guid.CreateVersion7(),
            SaleNumber = command.SaleNumber,
            Year = command.Year,
            Centre = centre,
            SaleDate = command.SaleDate,
            Broker = broker,
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
}
