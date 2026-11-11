using FluentValidation;
using Microsoft.Extensions.Logging;
using TeaAuction.Application.Abstractions;
using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Application.Catalog;

public sealed class PurchasedInvoiceService(
    IValidator<CreatePurchasedInvoiceCommand> validator,
    IPurchasedInvoicePdfParser parser,
    IPurchasedInvoiceRepository invoices,
    ISaleRepository sales,
    IFileStore files,
    IUnitOfWork unitOfWork,
    ILogger<PurchasedInvoiceService> logger)
{
    public Task<IReadOnlyList<PurchasedInvoiceSummaryDto>> ListAsync(CancellationToken cancellationToken) =>
        invoices.ListAsync(cancellationToken);

    public Task<PurchasedInvoiceDetailDto?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        invoices.GetDetailAsync(id, cancellationToken);

    public Task<PurchasedInvoiceWorkbenchDto?> GetWorkbenchAsync(
        string? saleNumber,
        int? year,
        CancellationToken cancellationToken) =>
        invoices.GetWorkbenchAsync(saleNumber, year, cancellationToken);

    public async Task<(Stream Content, string FileName, string ContentType)?> OpenPdfAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var invoice = await invoices.GetTrackedAsync(id, cancellationToken);
        if (invoice is null || string.IsNullOrWhiteSpace(invoice.StorageKey))
            return null;

        var stream = await files.OpenReadAsync(invoice.StorageKey, cancellationToken);
        return (stream, invoice.OriginalFileName, invoice.ContentType);
    }

    public async Task<OperationResult<UploadAcceptedDto>> CreateAsync(
        CreatePurchasedInvoiceCommand command,
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
            return OperationResult<UploadAcceptedDto>.Fail(validation.Errors.Select(e => e.ErrorMessage));

        if (!Enum.TryParse<AuctionCentre>(command.Centre, ignoreCase: true, out var centre))
            return OperationResult<UploadAcceptedDto>.Fail(["Centre is not recognised."]);
        if (!Enum.TryParse<BrokerCode>(command.Broker, ignoreCase: true, out var broker))
            return OperationResult<UploadAcceptedDto>.Fail(["Broker is not recognised."]);
        if (!command.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return OperationResult<UploadAcceptedDto>.Fail(["Upload a purchased-invoice PDF."]);

        await using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);
        buffer.Position = 0;
        var parsed = parser.Parse(broker, buffer);
        if (parsed.Lots.Count == 0)
            return OperationResult<UploadAcceptedDto>.Fail(
                parsed.Errors.Count > 0 ? parsed.Errors : ["No purchased lots found in the PDF."]);

        // Prefer the desk-entered sale number when it matches the contract numerically ("04" vs "4").
        var saleNumber = ResolveSaleNumber(command.SaleNumber, parsed.SaleNumberFromContract);
        var year = parsed.YearFromContract ?? command.Year;
        var saleDate = parsed.SaleDate ?? command.SaleDate;

        buffer.Position = 0;
        var storageKey = await files.SaveAsync(command.FileName, buffer, "application/pdf", cancellationToken);

        var sale = await sales.FindByKeyAsync(centre, year, saleNumber, cancellationToken)
            ?? await sales.FindByNumericKeyAsync(centre, year, saleNumber, cancellationToken);
        if (sale is null)
        {
            sale = new Sale
            {
                Id = Guid.CreateVersion7(),
                SaleNumber = saleNumber,
                Year = year,
                Centre = centre,
                SaleDate = saleDate,
                Status = SaleStatus.Open,
                CreatedAt = DateTimeOffset.UtcNow
            };
            await sales.AddAsync(sale, cancellationToken);
        }
        else
        {
            // Keep invoice sale number aligned with the auction board row.
            saleNumber = sale.SaleNumber;
        }

        var invoice = new PurchasedInvoice
        {
            Id = Guid.CreateVersion7(),
            SaleId = sale.Id,
            SaleNumber = saleNumber,
            Year = year,
            Centre = centre,
            SaleDate = saleDate,
            Broker = broker,
            BuyerCode = parsed.BuyerCode,
            BuyerName = parsed.BuyerName,
            ContractNo = parsed.ContractNo,
            OriginalFileName = command.FileName,
            StorageKey = storageKey,
            ContentType = "application/pdf",
            Status = UploadStatus.Completed,
            LotCount = parsed.Lots.Count,
            NetWeightKg = parsed.TotalNetKg ?? parsed.Lots.Sum(l => l.NetWeightKg),
            Proceeds = parsed.TotalProceeds ?? parsed.Lots.Sum(l => l.Proceeds),
            VatAmount = parsed.TotalVat ?? parsed.Lots.Sum(l => l.VatAmount),
            Payable = parsed.TotalPayable ?? 0,
            CreatedAt = DateTimeOffset.UtcNow,
            ProcessedAt = DateTimeOffset.UtcNow,
            Error = parsed.Errors.Count == 0 ? null : string.Join(" ", parsed.Errors.Take(5))
        };

        foreach (var row in parsed.Lots)
        {
            invoice.Lots.Add(new PurchasedInvoiceLot
            {
                Id = Guid.CreateVersion7(),
                PurchasedInvoiceId = invoice.Id,
                Broker = broker,
                LotNumber = row.LotNumber,
                SellingMark = row.SellingMark,
                InvoiceNumber = row.InvoiceNumber,
                Grade = row.Grade,
                Bags = row.Bags,
                NetPerBagKg = row.NetPerBagKg,
                NetWeightKg = row.NetWeightKg,
                SoldPricePerKg = row.SoldPricePerKg,
                Proceeds = row.Proceeds,
                VatAmount = row.VatAmount,
                ProceedsWithVat = row.ProceedsWithVat
            });
        }

        await invoices.AddAsync(invoice, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Accepted {LotCount} purchased lots for {Buyer} via {Broker} sale {Sale}/{Year}",
            invoice.LotCount, invoice.BuyerName, broker, saleNumber, year);

        return OperationResult<UploadAcceptedDto>.Ok(new UploadAcceptedDto(invoice.Id, invoice.Status, sale.Id));
    }

    internal static string ResolveSaleNumber(string requested, string? fromContract)
    {
        var desk = requested.Trim();
        if (string.IsNullOrWhiteSpace(fromContract))
            return desk;

        var parsed = fromContract.Trim();
        if (int.TryParse(desk, out var deskN) && int.TryParse(parsed, out var parsedN) && deskN == parsedN)
            return desk;
        return parsed;
    }
}
