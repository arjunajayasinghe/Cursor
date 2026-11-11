using TeaAuction.Application.Abstractions;

namespace TeaAuction.Infrastructure.Persistence;

public sealed class UnitOfWork(TeaAuctionDbContext db) : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken cancellationToken) => db.SaveChangesAsync(cancellationToken);
}
