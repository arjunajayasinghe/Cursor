namespace TeaAuction.Application.Catalog;

public sealed record CreateUploadCommand
{
    public required string SaleNumber { get; init; }

    public required int Year { get; init; }

    public required string Centre { get; init; }

    public required DateOnly SaleDate { get; init; }

    public required string Broker { get; init; }

    public required string FileName { get; init; }

    public required long Length { get; init; }
}

public sealed record LotCsvRow(
    int LineNumber,
    int LotNumber,
    string FactoryCode,
    string GardenMark,
    string InvoiceNumber,
    string Grade,
    int Bags,
    string PackageType,
    decimal? NetPerBagKg,
    decimal NetWeightKg,
    string SellingMark,
    string WarehouseOrBasis,
    string Category,
    decimal? ValuationPerKg,
    string SourceLine);

public sealed record LotCsvParseResult(IReadOnlyList<LotCsvRow> Rows, IReadOnlyList<string> Errors);

public sealed class NotificationOptions
{
    public const string SectionName = "Notifications";

    public string OperatorEmail { get; set; } = "ops@tea-auction.local";
}

public sealed class OperationResult<T>
{
    private OperationResult(T? value, IReadOnlyList<string> errors)
    {
        Value = value;
        Errors = errors;
    }

    public T? Value { get; }

    public IReadOnlyList<string> Errors { get; }

    public bool Succeeded => Errors.Count == 0;

    public static OperationResult<T> Ok(T value) => new(value, []);

    public static OperationResult<T> Fail(IEnumerable<string> errors) => new(default, errors.ToArray());
}
