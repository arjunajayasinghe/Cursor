using Microsoft.Extensions.Options;
using TeaAuction.Application.Abstractions;

namespace TeaAuction.Infrastructure.Storage;

public sealed class FileStoreOptions
{
    public const string SectionName = "FileStore";

    public string Provider { get; set; } = "FileSystem";

    public string Root { get; set; } = "data/uploads";

    public string Bucket { get; set; } = "tea-uploads";

    public string? ServiceUrl { get; set; }

    public string? AccessKey { get; set; }

    public string? SecretKey { get; set; }

    public string Region { get; set; } = "us-east-1";

    public bool ForcePathStyle { get; set; } = true;
}

public sealed class FileSystemFileStore(IOptions<FileStoreOptions> options) : IFileStore
{
    private readonly string _root = Path.GetFullPath(options.Value.Root);

    public async Task<string> SaveAsync(string fileName, Stream content, string contentType, CancellationToken cancellationToken)
    {
        var key = $"{DateTime.UtcNow:yyyy/MM/dd}/{Guid.CreateVersion7():N}-{Sanitize(fileName)}";
        var path = Resolve(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        await content.CopyToAsync(file, cancellationToken);
        return key;
    }

    public Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken)
    {
        var path = Resolve(storageKey);
        Stream stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult(stream);
    }

    private string Resolve(string storageKey)
    {
        var root = Path.GetFullPath(_root);
        var path = Path.GetFullPath(Path.Combine(root, storageKey));
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        if (!path.StartsWith(root + Path.DirectorySeparatorChar, comparison) && !path.Equals(root, comparison))
            throw new InvalidOperationException("The storage key is outside the upload directory.");
        return path;
    }

    internal static string Sanitize(string fileName)
    {
        var name = Path.GetFileName(fileName);
        if (string.IsNullOrWhiteSpace(name))
            return "upload.csv";

        var chars = name.Select(ch => char.IsAsciiLetterOrDigit(ch) || ch is '.' or '-' or '_' ? ch : '_').ToArray();
        var cleaned = new string(chars).Trim('_');
        return string.IsNullOrWhiteSpace(cleaned) ? "upload.csv" : cleaned;
    }
}
