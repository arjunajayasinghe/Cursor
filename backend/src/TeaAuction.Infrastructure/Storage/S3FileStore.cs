using Amazon;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;
using TeaAuction.Application.Abstractions;

namespace TeaAuction.Infrastructure.Storage;

public sealed class S3FileStore : IFileStore
{
    private readonly IAmazonS3 _client;
    private readonly FileStoreOptions _options;
    private readonly SemaphoreSlim _bucketLock = new(1, 1);
    private bool _bucketReady;

    public S3FileStore(IAmazonS3 client, IOptions<FileStoreOptions> options)
    {
        _client = client;
        _options = options.Value;
    }

    public async Task<string> SaveAsync(string fileName, Stream content, string contentType, CancellationToken cancellationToken)
    {
        await EnsureBucketAsync(cancellationToken);
        var key = $"{DateTime.UtcNow:yyyy/MM/dd}/{Guid.CreateVersion7():N}-{FileSystemFileStore.Sanitize(fileName)}";
        await _client.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _options.Bucket,
            Key = key,
            InputStream = content,
            ContentType = string.IsNullOrWhiteSpace(contentType) ? "text/csv" : contentType
        }, cancellationToken);
        return key;
    }

    public async Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken)
    {
        using var response = await _client.GetObjectAsync(_options.Bucket, storageKey, cancellationToken);
        var copy = new MemoryStream();
        await response.ResponseStream.CopyToAsync(copy, cancellationToken);
        copy.Position = 0;
        return copy;
    }

    private async Task EnsureBucketAsync(CancellationToken cancellationToken)
    {
        if (_bucketReady)
            return;

        await _bucketLock.WaitAsync(cancellationToken);
        try
        {
            if (_bucketReady)
                return;

            try
            {
                await _client.PutBucketAsync(_options.Bucket, cancellationToken);
            }
            catch (AmazonS3Exception exception) when (exception.ErrorCode is "BucketAlreadyOwnedByYou" or "BucketAlreadyExists")
            {
            }

            _bucketReady = true;
        }
        finally
        {
            _bucketLock.Release();
        }
    }

    public static IAmazonS3 CreateClient(FileStoreOptions options)
    {
        var config = new AmazonS3Config
        {
            ForcePathStyle = options.ForcePathStyle,
            AuthenticationRegion = string.IsNullOrWhiteSpace(options.Region) ? "us-east-1" : options.Region
        };

        if (!string.IsNullOrWhiteSpace(options.ServiceUrl))
            config.ServiceURL = options.ServiceUrl;
        else
            config.RegionEndpoint = RegionEndpoint.GetBySystemName(config.AuthenticationRegion);

        if (!string.IsNullOrWhiteSpace(options.AccessKey) && !string.IsNullOrWhiteSpace(options.SecretKey))
            return new AmazonS3Client(options.AccessKey, options.SecretKey, config);

        return new AmazonS3Client(config);
    }
}
