using Hangfire;
using TeaAuction.Application.Abstractions;
using TeaAuction.Application.Catalog;

namespace TeaAuction.Infrastructure.Jobs;

public sealed class ProcessUploadJob(UploadProcessingService processor)
{
    public Task Execute(Guid uploadBatchId) => processor.ProcessAsync(uploadBatchId, CancellationToken.None);
}

public sealed class HangfireUploadJobScheduler : IUploadJobScheduler
{
    public void EnqueueProcessUpload(Guid uploadBatchId)
    {
        BackgroundJob.Enqueue<ProcessUploadJob>(job => job.Execute(uploadBatchId));
    }
}
