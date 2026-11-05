using Microsoft.EntityFrameworkCore;
using TeaAuction.Application.Abstractions;
using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Infrastructure.Persistence;

public sealed class SaleRepository(TeaAuctionDbContext db) : ISaleRepository
{
    public async Task<IReadOnlyList<SaleSummaryDto>> ListAsync(CancellationToken cancellationToken)
    {
        return await db.Sales.AsNoTracking()
            .OrderByDescending(sale => sale.SaleDate)
            .ThenBy(sale => sale.Centre)
            .ThenBy(sale => sale.SaleNumber)
            .Select(sale => new SaleSummaryDto(
                sale.Id,
                sale.SaleNumber,
                sale.Year,
                sale.Centre,
                sale.SaleDate,
                sale.Status,
                sale.Lots.Count,
                sale.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public Task<Sale?> GetByIdWithDetailsAsync(Guid id, CancellationToken cancellationToken) =>
        db.Sales.AsNoTracking()
            .AsSplitQuery()
            .Include(sale => sale.Lots)
            .Include(sale => sale.Uploads)
            .FirstOrDefaultAsync(sale => sale.Id == id, cancellationToken);

    public Task<Sale?> FindByKeyAsync(AuctionCentre centre, int year, string saleNumber, CancellationToken cancellationToken) =>
        db.Sales.FirstOrDefaultAsync(
            sale => sale.Centre == centre && sale.Year == year && sale.SaleNumber == saleNumber,
            cancellationToken);

    public Task AddAsync(Sale sale, CancellationToken cancellationToken)
    {
        db.Sales.Add(sale);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<int>> FindExistingLotNumbersAsync(
        Guid saleId,
        BrokerCode broker,
        IReadOnlyCollection<int> lotNumbers,
        CancellationToken cancellationToken)
    {
        return await db.Lots.AsNoTracking()
            .Where(lot => lot.SaleId == saleId && lot.Broker == broker && lotNumbers.Contains(lot.LotNumber))
            .Select(lot => lot.LotNumber)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Lot>> FindTrackedLotsAsync(
        Guid saleId,
        BrokerCode broker,
        IReadOnlyCollection<int> lotNumbers,
        CancellationToken cancellationToken)
    {
        return await db.Lots
            .Where(lot => lot.SaleId == saleId && lot.Broker == broker && lotNumbers.Contains(lot.LotNumber))
            .ToListAsync(cancellationToken);
    }

    public void AddLot(Lot lot) => db.Lots.Add(lot);
}
