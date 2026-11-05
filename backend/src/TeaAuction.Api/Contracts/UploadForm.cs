namespace TeaAuction.Api.Contracts;

public sealed class UploadForm
{
    public string SaleNumber { get; set; } = "";

    public int Year { get; set; }

    public string Centre { get; set; } = "";

    public DateOnly SaleDate { get; set; }

    public string Broker { get; set; } = "";

    public IFormFile? File { get; set; }
}
