namespace TeaAuction.Domain;

public sealed class BlendSheet
{
    public Guid Id { get; set; }

    public string BlendNumber { get; set; } = "";

    public DateOnly BlendDate { get; set; }

    public string? SalesOrderRef { get; set; }

    public string? CustomerName { get; set; }

    public string ProductName { get; set; } = "";

    public decimal TargetQuantityKg { get; set; }

    public decimal? TargetPricePerKg { get; set; }

    public string Currency { get; set; } = "LKR";

    public decimal? TargetTeaCostPerKg { get; set; }

    public string PreparedBy { get; set; } = "";

    public BlendSheetStatus Status { get; set; } = BlendSheetStatus.Draft;

    public string? Remarks { get; set; }

    public decimal AllocatedQuantityKg { get; set; }

    public decimal TotalRawTeaCost { get; set; }

    public decimal? WeightedAverageCostPerKg { get; set; }

    /// <summary>Active compare option (A/B/C…). Inventory holds and confirm use this option only.</summary>
    public string ActiveOptionKey { get; set; } = "A";

    public int Version { get; set; } = 1;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }

    public DateTimeOffset? ConfirmedAt { get; set; }

    public ICollection<BlendSheetLine> Lines { get; set; } = new List<BlendSheetLine>();

    public ICollection<InventoryReservation> Reservations { get; set; } = new List<InventoryReservation>();
}

public sealed class BlendSheetLine
{
    public Guid Id { get; set; }

    public Guid BlendSheetId { get; set; }

    public BlendSheet? BlendSheet { get; set; }

    /// <summary>Compare option key this line belongs to (A/B/C…).</summary>
    public string OptionKey { get; set; } = "A";

    public Guid CollectionLotId { get; set; }

    public CollectionLot? CollectionLot { get; set; }

    public Guid? SampleBoxId { get; set; }

    public string SaleNumber { get; set; } = "";

    public int Year { get; set; }

    public BrokerCode Broker { get; set; }

    public int LotNumber { get; set; }

    public string Estate { get; set; } = "";

    public string Grade { get; set; } = "";

    public string WarehouseOrBasis { get; set; } = "";

    public decimal PurchasedQtyKg { get; set; }

    public decimal PhysicalStockKg { get; set; }

    public decimal AllocatedQtyKg { get; set; }

    public decimal UnitCostPerKg { get; set; }

    public string QualityStatus { get; set; } = "Approved";

    public decimal LineCost => AllocatedQtyKg * UnitCostPerKg;
}

public sealed class InventoryReservation
{
    public Guid Id { get; set; }

    public Guid BlendSheetId { get; set; }

    public BlendSheet? BlendSheet { get; set; }

    public int BlendVersion { get; set; } = 1;

    public Guid CollectionLotId { get; set; }

    public CollectionLot? CollectionLot { get; set; }

    public string? SapItemCode { get; set; }

    public string? SapBatchNumber { get; set; }

    public string WarehouseOrBasis { get; set; } = "";

    public decimal ReservedQuantityKg { get; set; }

    public decimal ConsumedQuantityKg { get; set; }

    public decimal ReleasedQuantityKg { get; set; }

    public InventoryReservationStatus Status { get; set; } = InventoryReservationStatus.Temp;

    public string CreatedBy { get; set; } = "";

    public DateTimeOffset CreatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }
}
