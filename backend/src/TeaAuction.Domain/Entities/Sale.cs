namespace TeaAuction.Domain;

public sealed class Sale
{
    public Guid Id { get; set; }

    public string SaleNumber { get; set; } = "";

    public int Year { get; set; }

    public AuctionCentre Centre { get; set; }

    public DateOnly SaleDate { get; set; }

    public SaleStatus Status { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<Lot> Lots { get; set; } = new List<Lot>();

    public ICollection<UploadBatch> Uploads { get; set; } = new List<UploadBatch>();

    public ICollection<PurchasedInvoice> PurchasedInvoices { get; set; } = new List<PurchasedInvoice>();
}
