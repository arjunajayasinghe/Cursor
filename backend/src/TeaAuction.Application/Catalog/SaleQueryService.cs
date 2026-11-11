using TeaAuction.Application.Abstractions;
using TeaAuction.Application.Dtos;
using TeaAuction.Application.Mapping;

namespace TeaAuction.Application.Catalog;

public sealed class SaleQueryService(ISaleRepository sales, IUploadBatchRepository uploads)
{
    public Task<IReadOnlyList<SaleSummaryDto>> ListAsync(CancellationToken cancellationToken) =>
        sales.ListAsync(cancellationToken);

    public async Task<SaleDetailDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var sale = await sales.GetByIdWithDetailsAsync(id, cancellationToken);
        return sale is null ? null : SaleMapper.ToDetail(sale);
    }

    public async Task<IReadOnlyList<UploadBatchDto>> ListUploadsAsync(CancellationToken cancellationToken)
    {
        var batches = await uploads.ListAsync(cancellationToken);
        return batches.Select(SaleMapper.ToUpload).ToList();
    }

    public async Task<UploadDetailDto?> GetUploadAsync(Guid id, CancellationToken cancellationToken)
    {
        var batch = await uploads.GetWithLotsAsync(id, cancellationToken);
        return batch is null ? null : SaleMapper.ToUploadDetail(batch);
    }
}
