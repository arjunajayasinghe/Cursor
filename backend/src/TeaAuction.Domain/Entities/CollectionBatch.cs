namespace TeaAuction.Domain;

/// <summary>
/// Ops working set for one sale: lots selected from purchase-invoice PDFs
/// to drive sample/bag collection and later blend sheets.
/// </summary>
public sealed class CollectionBatch
{
    public Guid Id { get; set; }

    public Guid? SaleId { get; set; }

    public Sale? Sale { get; set; }

    public string SaleNumber { get; set; } = "";

    public int Year { get; set; }

    public AuctionCentre Centre { get; set; }

    public DateOnly SaleDate { get; set; }

    public string Name { get; set; } = "";

    public CollectionBatchStatus Status { get; set; } = CollectionBatchStatus.Selected;

    public int LotCount { get; set; }

    public int BagCount { get; set; }

    public decimal NetWeightKg { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }

    public ICollection<CollectionLot> Lots { get; set; } = new List<CollectionLot>();
}

/// <summary>
/// Snapshot of a PDF invoice lot (plus WH from sales) copied into the collection stage.
/// </summary>
public sealed class CollectionLot
{
    public Guid Id { get; set; }

    public Guid CollectionBatchId { get; set; }

    public CollectionBatch? CollectionBatch { get; set; }

    public Guid? PurchasedInvoiceLotId { get; set; }

    public Guid? PurchasedInvoiceId { get; set; }

    public Guid? CatalogueLotId { get; set; }

    public BrokerCode Broker { get; set; }

    public int LotNumber { get; set; }

    public string SellingMark { get; set; } = "";

    public string SellerName { get; set; } = "";

    public string SellerVatNo { get; set; } = "";

    public string InvoiceNumber { get; set; } = "";

    public string Grade { get; set; } = "";

    public int Bags { get; set; }

    public decimal? NetPerBagKg { get; set; }

    public decimal NetWeightKg { get; set; }

    public decimal SoldPricePerKg { get; set; }

    public decimal Proceeds { get; set; }

    public decimal VatAmount { get; set; }

    public decimal ProceedsWithVat { get; set; }

    /// <summary>From sales/catalogue text: EXESTATE or named warehouse.</summary>
    public string WarehouseOrBasis { get; set; } = "";

    public string BuyerCode { get; set; } = "";

    public string BuyerName { get; set; } = "";

    public string GardenMark { get; set; } = "";

    public DateTimeOffset SelectedAt { get; set; }
}
