namespace TeaAuction.Domain;

public sealed class UploadBatch
{
    public Guid Id { get; set; }

    public Guid? SaleId { get; set; }

    public Sale? Sale { get; set; }

    public string SaleNumber { get; set; } = "";

    public int Year { get; set; }

    public AuctionCentre Centre { get; set; }

    public DateOnly SaleDate { get; set; }

    public BrokerCode Broker { get; set; }

    public string OriginalFileName { get; set; } = "";

    public string StorageKey { get; set; } = "";

    public string ContentType { get; set; } = "";

    public UploadStatus Status { get; set; }

    public string? Error { get; set; }

    public int LotCount { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? ProcessedAt { get; set; }

    public ICollection<Lot> Lots { get; set; } = new List<Lot>();
}
