using Microsoft.EntityFrameworkCore;
using TeaAuction.Application.Abstractions;
using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Infrastructure.Persistence;

public sealed class PurchasedInvoiceRepository(TeaAuctionDbContext db) : IPurchasedInvoiceRepository
{
    public async Task AddAsync(PurchasedInvoice invoice, CancellationToken cancellationToken) =>
        await db.PurchasedInvoices.AddAsync(invoice, cancellationToken);

    public async Task<IReadOnlyList<PurchasedInvoiceSummaryDto>> ListAsync(CancellationToken cancellationToken)
    {
        var rows = await db.PurchasedInvoices.AsNoTracking()
            .OrderByDescending(x => x.SaleDate)
            .ThenByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
        return rows.Select(MapSummary).ToList();
    }

    public async Task<PurchasedInvoiceDetailDto?> GetDetailAsync(Guid id, CancellationToken cancellationToken)
    {
        var invoice = await db.PurchasedInvoices.AsNoTracking()
            .Include(x => x.Lots)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (invoice is null) return null;
        return new PurchasedInvoiceDetailDto(
            invoice.Id,
            invoice.SaleId,
            invoice.SaleNumber,
            invoice.Year,
            invoice.Centre,
            invoice.SaleDate,
            invoice.Broker,
            invoice.BuyerCode,
            invoice.BuyerName,
            invoice.ContractNo,
            invoice.Status,
            invoice.OriginalFileName,
            invoice.LotCount,
            invoice.NetWeightKg,
            invoice.Proceeds,
            invoice.VatAmount,
            invoice.Payable,
            invoice.Error,
            invoice.CreatedAt,
            invoice.Lots.OrderBy(l => l.LotNumber).Select(MapLot).ToList());
    }

    public async Task<PurchasedInvoiceWorkbenchDto?> GetWorkbenchAsync(
        string? saleNumber,
        int? year,
        CancellationToken cancellationToken)
    {
        var all = await db.PurchasedInvoices.AsNoTracking().Include(x => x.Lots).ToListAsync(cancellationToken);
        if (all.Count == 0) return null;

        string targetSale;
        int targetYear;
        if (!string.IsNullOrWhiteSpace(saleNumber) && year is int y)
        {
            targetSale = saleNumber.Trim();
            targetYear = y;
        }
        else
        {
            var latest = all
                .OrderByDescending(x => x.SaleDate)
                .ThenByDescending(x => x.Year)
                .ThenByDescending(x => x.CreatedAt)
                .First();
            targetSale = latest.SaleNumber;
            targetYear = latest.Year;
        }

        var invoices = all
            .Where(x => x.Year == targetYear && SaleNumbersMatch(x.SaleNumber, targetSale))
            .OrderBy(x => x.Broker)
            .ThenByDescending(x => x.CreatedAt)
            .ToList();
        if (invoices.Count == 0) return null;

        // Latest upload per broker wins when re-uploaded.
        var byBroker = invoices
            .GroupBy(x => x.Broker)
            .Select(g => g.OrderByDescending(x => x.CreatedAt).First())
            .OrderBy(x => x.Broker)
            .ToList();

        var first = byBroker[0];
        var lots = byBroker
            .SelectMany(inv => inv.Lots.OrderBy(l => l.LotNumber).Select(MapLot))
            .ToList();

        return new PurchasedInvoiceWorkbenchDto(
            first.SaleId,
            first.SaleNumber,
            first.Year,
            first.SaleDate,
            byBroker.Select(MapSummary).ToList(),
            lots);
    }

    private static bool SaleNumbersMatch(string left, string right)
    {
        if (string.Equals(left, right, StringComparison.OrdinalIgnoreCase))
            return true;
        return int.TryParse(left, out var a) && int.TryParse(right, out var b) && a == b;
    }

    private static PurchasedInvoiceSummaryDto MapSummary(PurchasedInvoice invoice) =>
        new(
            invoice.Id,
            invoice.SaleId,
            invoice.SaleNumber,
            invoice.Year,
            invoice.Centre,
            invoice.SaleDate,
            invoice.Broker,
            invoice.BuyerCode,
            invoice.BuyerName,
            invoice.ContractNo,
            invoice.Status,
            invoice.OriginalFileName,
            invoice.LotCount,
            invoice.NetWeightKg,
            invoice.Proceeds,
            invoice.VatAmount,
            invoice.Payable,
            invoice.Error,
            invoice.CreatedAt);

    private static PurchasedInvoiceLotDto MapLot(PurchasedInvoiceLot lot) =>
        new(
            lot.Id,
            lot.Broker,
            lot.LotNumber,
            lot.SellingMark,
            lot.InvoiceNumber,
            lot.Grade,
            lot.Bags,
            lot.NetWeightKg,
            lot.SoldPricePerKg,
            lot.Proceeds,
            lot.VatAmount,
            lot.ProceedsWithVat);
}
