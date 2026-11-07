using Microsoft.Extensions.Logging;
using TeaAuction.Application.Abstractions;
using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Application.Catalog;

public sealed class CollectionService(
    ICollectionRepository collections,
    ISaleRepository sales,
    IUnitOfWork unitOfWork,
    ILogger<CollectionService> logger)
{
    public Task<IReadOnlyList<CollectionBatchSummaryDto>> ListAsync(CancellationToken cancellationToken) =>
        collections.ListBatchesAsync(cancellationToken);

    public Task<CollectionBatchDetailDto?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        collections.GetBatchAsync(id, cancellationToken);

    public Task<IReadOnlyList<Guid>> ListCollectedInvoiceLotIdsAsync(
        string saleNumber,
        int year,
        CancellationToken cancellationToken) =>
        ListCollectedAsync(saleNumber, year, cancellationToken);

    private async Task<IReadOnlyList<Guid>> ListCollectedAsync(
        string saleNumber,
        int year,
        CancellationToken cancellationToken)
    {
        var sn = (saleNumber ?? "").Trim();
        if (string.IsNullOrWhiteSpace(sn) || year < 2000)
            return [];
        var set = await collections.ListCollectedInvoiceLotIdsForSaleAsync(
            AuctionCentre.Colombo, year, sn, cancellationToken);
        return set.OrderBy(x => x).ToList();
    }

    public async Task<OperationResult<CollectionBatchDetailDto>> SelectLotsAsync(
        SelectCollectionLotsRequest request,
        CancellationToken cancellationToken)
    {
        var saleNumber = (request.SaleNumber ?? "").Trim();
        if (string.IsNullOrWhiteSpace(saleNumber))
            return OperationResult<CollectionBatchDetailDto>.Fail(["Sale number is required."]);
        if (request.Year < 2000 || request.Year > 2100)
            return OperationResult<CollectionBatchDetailDto>.Fail(["Year looks invalid."]);
        if (request.PurchasedInvoiceLotIds is null || request.PurchasedInvoiceLotIds.Count == 0)
            return OperationResult<CollectionBatchDetailDto>.Fail(["Select at least one PDF invoice lot."]);

        var ids = request.PurchasedInvoiceLotIds.Distinct().ToArray();
        var invoiceLots = await collections.GetInvoiceLotsAsync(ids, cancellationToken);
        if (invoiceLots.Count == 0)
            return OperationResult<CollectionBatchDetailDto>.Fail(["No purchased invoice lots matched the selection."]);
        if (invoiceLots.Count != ids.Length)
        {
            var found = invoiceLots.Select(l => l.Id).ToHashSet();
            var missing = ids.Count(id => !found.Contains(id));
            return OperationResult<CollectionBatchDetailDto>.Fail([$"{missing} selected lot(s) were not found."]);
        }

        // Hard block: once a PDF lot is in any collection batch, it cannot be sent again.
        var alreadyCollected = await collections.FindCollectedInvoiceLotIdsAsync(ids, cancellationToken);
        if (alreadyCollected.Count > 0)
        {
            var blocked = invoiceLots
                .Where(l => alreadyCollected.Contains(l.Id))
                .Select(l => $"{l.Broker} lot {l.LotNumber}")
                .Take(8)
                .ToList();
            var more = alreadyCollected.Count > blocked.Count
                ? $" (+{alreadyCollected.Count - blocked.Count} more)"
                : "";
            return OperationResult<CollectionBatchDetailDto>.Fail([
                $"Already in collection — remove from selection: {string.Join(", ", blocked)}{more}."
            ]);
        }

        var sale = await sales.FindByKeyAsync(AuctionCentre.Colombo, request.Year, saleNumber, cancellationToken)
            ?? await sales.FindByNumericKeyAsync(AuctionCentre.Colombo, request.Year, saleNumber, cancellationToken);

        var batch = await collections.FindOpenBatchAsync(AuctionCentre.Colombo, request.Year, saleNumber, cancellationToken);
        var createdNew = false;
        if (batch is null)
        {
            batch = new CollectionBatch
            {
                Id = Guid.CreateVersion7(),
                SaleId = sale?.Id,
                SaleNumber = sale?.SaleNumber ?? saleNumber,
                Year = request.Year,
                Centre = sale?.Centre ?? AuctionCentre.Colombo,
                SaleDate = sale?.SaleDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
                Name = string.IsNullOrWhiteSpace(request.Name)
                    ? $"Sale {saleNumber}/{request.Year} collection"
                    : request.Name.Trim(),
                Status = CollectionBatchStatus.Selected,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            await collections.AddBatchAsync(batch, cancellationToken);
            createdNew = true;
        }
        else
        {
            batch.Status = CollectionBatchStatus.Selected;
            batch.UpdatedAt = DateTimeOffset.UtcNow;
            if (!string.IsNullOrWhiteSpace(request.Name))
                batch.Name = request.Name.Trim();
            if (sale is not null)
            {
                batch.SaleId = sale.Id;
                batch.SaleDate = sale.SaleDate;
            }
        }

        IReadOnlyDictionary<(BrokerCode Broker, int LotNumber), Lot> catalogue =
            new Dictionary<(BrokerCode, int), Lot>();
        if (sale is not null)
        {
            var keys = invoiceLots.Select(l => (l.Broker, l.LotNumber)).Distinct().ToArray();
            catalogue = await collections.FindCatalogueLotsAsync(sale.Id, keys, cancellationToken);
        }

        var now = DateTimeOffset.UtcNow;
        var newLots = new List<CollectionLot>(invoiceLots.Count);
        foreach (var pdf in invoiceLots)
        {
            catalogue.TryGetValue((pdf.Broker, pdf.LotNumber), out var cat);
            var invoice = pdf.PurchasedInvoice;
            newLots.Add(new CollectionLot
            {
                Id = Guid.CreateVersion7(),
                CollectionBatchId = batch.Id,
                PurchasedInvoiceLotId = pdf.Id,
                PurchasedInvoiceId = pdf.PurchasedInvoiceId,
                CatalogueLotId = cat?.Id,
                Broker = pdf.Broker,
                LotNumber = pdf.LotNumber,
                SellingMark = pdf.SellingMark,
                SellerName = string.IsNullOrWhiteSpace(pdf.SellerName) ? (cat?.GardenMark ?? "") : pdf.SellerName,
                SellerVatNo = pdf.SellerVatNo ?? "",
                InvoiceNumber = pdf.InvoiceNumber,
                Grade = pdf.Grade,
                Bags = pdf.Bags,
                NetPerBagKg = pdf.NetPerBagKg,
                NetWeightKg = pdf.NetWeightKg,
                SoldPricePerKg = pdf.SoldPricePerKg,
                Proceeds = pdf.Proceeds,
                VatAmount = pdf.VatAmount,
                ProceedsWithVat = pdf.ProceedsWithVat,
                WarehouseOrBasis = cat?.WarehouseOrBasis ?? "",
                BuyerCode = invoice?.BuyerCode ?? cat?.BuyerCode ?? "",
                BuyerName = invoice?.BuyerName ?? "",
                GardenMark = cat?.GardenMark ?? "",
                SelectedAt = now
            });
        }

        await collections.AddLotsAsync(newLots, cancellationToken);
        // Persist inserts first so aggregate query sees the new rows (and avoids
        // updating a batch graph that still has a stale Included Lots collection).
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await collections.RecalcBatchAggregatesAsync(batch.Id, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Added {Count} PDF lots to collection batch {BatchId} for sale {Sale}/{Year} (newBatch={New})",
            newLots.Count,
            batch.Id,
            batch.SaleNumber,
            batch.Year,
            createdNew);

        var detail = await collections.GetBatchAsync(batch.Id, cancellationToken);
        return detail is null
            ? OperationResult<CollectionBatchDetailDto>.Fail(["Batch was saved but could not be reloaded."])
            : OperationResult<CollectionBatchDetailDto>.Ok(detail);
    }
}
