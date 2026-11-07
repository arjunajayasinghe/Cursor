namespace TeaAuction.Domain;

/// <summary>
/// One broker purchase-invoice PDF for a buyer's account (e.g. Venture Tea).
/// </summary>
public sealed class PurchasedInvoice
{
    public Guid Id { get; set; }

    public Guid? SaleId { get; set; }

    public Sale? Sale { get; set; }

    public string SaleNumber { get; set; } = "";

    public int Year { get; set; }

    public AuctionCentre Centre { get; set; }

    public DateOnly SaleDate { get; set; }

    public BrokerCode Broker { get; set; }

    public string BuyerCode { get; set; } = "";

    public string BuyerName { get; set; } = "";

    public string ContractNo { get; set; } = "";

    public string OriginalFileName { get; set; } = "";

    public string StorageKey { get; set; } = "";

    public string ContentType { get; set; } = "application/pdf";

    public UploadStatus Status { get; set; }

    public string? Error { get; set; }

    public int LotCount { get; set; }

    public decimal NetWeightKg { get; set; }

    public decimal Proceeds { get; set; }

    public decimal VatAmount { get; set; }

    public decimal Payable { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? ProcessedAt { get; set; }

    public ICollection<PurchasedInvoiceLot> Lots { get; set; } = new List<PurchasedInvoiceLot>();
}

public sealed class PurchasedInvoiceLot
{
    public Guid Id { get; set; }

    public Guid PurchasedInvoiceId { get; set; }

    public PurchasedInvoice? PurchasedInvoice { get; set; }

    public BrokerCode Broker { get; set; }

    public int LotNumber { get; set; }

    public string SellingMark { get; set; } = "";

    public string InvoiceNumber { get; set; } = "";

    public string Grade { get; set; } = "";

    public int Bags { get; set; }

    public decimal? NetPerBagKg { get; set; }

    public decimal NetWeightKg { get; set; }

    public decimal SoldPricePerKg { get; set; }

    public decimal Proceeds { get; set; }

    public decimal VatAmount { get; set; }

    public decimal ProceedsWithVat { get; set; }
}
