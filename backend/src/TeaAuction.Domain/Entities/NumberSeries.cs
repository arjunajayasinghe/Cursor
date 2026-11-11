namespace TeaAuction.Domain;

/// <summary>Configurable document numbering (e.g. sample boxes BOX-2026-000001).</summary>
public sealed class NumberSeries
{
    public Guid Id { get; set; }

    /// <summary>Stable code, e.g. SAMPLE_BOX.</summary>
    public string Code { get; set; } = "";

    public string Prefix { get; set; } = "";

    public int Year { get; set; }

    public int NextNumber { get; set; } = 1;

    public int PadLength { get; set; } = 6;

    public DateTimeOffset UpdatedAt { get; set; }

    public string Format(int number) =>
        $"{Prefix}-{Year}-{number.ToString().PadLeft(PadLength, '0')}";
}
