namespace TeaAuction.Domain;

public sealed class Lot
{
    public Guid Id { get; set; }

    public Guid SaleId { get; set; }

    public Sale Sale { get; set; } = null!;

    public Guid? UploadBatchId { get; set; }

    public UploadBatch? UploadBatch { get; set; }

    public BrokerCode Broker { get; set; }

    public int LotNumber { get; set; }

    public string FactoryCode { get; set; } = "";

    public string GardenMark { get; set; } = "";

    public string InvoiceNumber { get; set; } = "";

    public string Grade { get; set; } = "";

    public int Bags { get; set; }

    public string PackageType { get; set; } = "";

    public decimal? NetPerBagKg { get; set; }

    public decimal NetWeightKg { get; set; }

    public string SellingMark { get; set; } = "";

    public string WarehouseOrBasis { get; set; } = "";

    public string Category { get; set; } = "";

    public decimal? ValuationPerKg { get; set; }

    public decimal? SoldPricePerKg { get; set; }

    public string BuyerCode { get; set; } = "";

    public Guid? SalesUploadBatchId { get; set; }

    public string SourceLine { get; set; } = "";
}
