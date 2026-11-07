namespace TeaAuction.Domain;

/// <summary>
/// Physical sample-collection container. One box may hold samples from many purchased lots.
/// Box numbers identify containers — they do not replace auction lot or package numbers.
/// </summary>
public sealed class SampleBox
{
    public Guid Id { get; set; }

    public Guid CollectionBatchId { get; set; }

    public CollectionBatch? CollectionBatch { get; set; }

    public string BoxNumber { get; set; } = "";

    public SampleBoxStatus Status { get; set; } = SampleBoxStatus.Open;

    public int LotCount { get; set; }

    public int BagCount { get; set; }

    public decimal NetWeightKg { get; set; }

    public string WarehouseOrBasis { get; set; } = "";

    public string? CollectorName { get; set; }

    public string? Remarks { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? PrintedAt { get; set; }

    public int PrintCount { get; set; }

    public DateTimeOffset? ReceivedAt { get; set; }

    public string? ReceivedBy { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }

    public ICollection<CollectionLot> Lots { get; set; } = new List<CollectionLot>();
}
