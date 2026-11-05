using Microsoft.EntityFrameworkCore;
using TeaAuction.Application.Abstractions;
using TeaAuction.Domain;

namespace TeaAuction.Infrastructure.Persistence;

public sealed class UploadBatchRepository(TeaAuctionDbContext db) : IUploadBatchRepository
{
    public Task AddAsync(UploadBatch batch, CancellationToken cancellationToken)
    {
        db.UploadBatches.Add(batch);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<UploadBatch>> ListAsync(CancellationToken cancellationToken) =>
        await db.UploadBatches.AsNoTracking()
            .OrderByDescending(batch => batch.CreatedAt)
            .ThenByDescending(batch => batch.Id)
            .ToListAsync(cancellationToken);

    public Task<UploadBatch?> GetTrackedAsync(Guid id, CancellationToken cancellationToken) =>
        db.UploadBatches.FirstOrDefaultAsync(batch => batch.Id == id, cancellationToken);

    public Task<UploadBatch?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        db.UploadBatches.AsNoTracking().FirstOrDefaultAsync(batch => batch.Id == id, cancellationToken);

    public async Task<UploadBatch?> GetWithLotsAsync(Guid id, CancellationToken cancellationToken)
    {
        var batch = await db.UploadBatches.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (batch is null) return null;

        if (batch.Kind == UploadKind.PostAuctionSales)
        {
            batch.Lots = await db.Lots.AsNoTracking()
                .Where(lot => lot.SalesUploadBatchId == id)
                .OrderBy(lot => lot.LotNumber)
                .ToListAsync(cancellationToken);
        }
        else
        {
            batch.Lots = await db.Lots.AsNoTracking()
                .Where(lot => lot.UploadBatchId == id)
                .OrderBy(lot => lot.LotNumber)
                .ToListAsync(cancellationToken);
        }

        return batch;
    }

    public async Task MarkFailedAsync(Guid id, string error, CancellationToken cancellationToken)
    {
        db.ChangeTracker.Clear();
        var batch = await db.UploadBatches.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (batch is null || batch.Status == UploadStatus.Completed)
            return;

        batch.Status = UploadStatus.Failed;
        batch.Error = error.Length <= 2000 ? error : error[..2000];
        batch.ProcessedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }
}
