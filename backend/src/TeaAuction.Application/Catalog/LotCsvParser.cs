using System.Globalization;
using System.Text;
using TeaAuction.Application.Abstractions;

namespace TeaAuction.Application.Catalog;

public sealed class LotCsvParser : ILotCsvParser
{
    private static readonly string[] RequiredHeaders =
    [
        "lotnumber",
        "gardenmark",
        "invoicenumber",
        "grade",
        "bags",
        "netweightkg",
        "valuationperkg"
    ];

    private static readonly Dictionary<string, string> HeaderLabels = new(StringComparer.Ordinal)
    {
        ["lotnumber"] = "lotNumber",
        ["gardenmark"] = "gardenMark",
        ["invoicenumber"] = "invoiceNumber",
        ["grade"] = "grade",
        ["bags"] = "bags",
        ["netweightkg"] = "netWeightKg",
        ["valuationperkg"] = "valuationPerKg"
    };

    public LotCsvParseResult Parse(Stream csv)
    {
        using var reader = new StreamReader(csv, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
        var records = ReadRecords(reader.ReadToEnd());
        if (records.Count == 0)
            return new LotCsvParseResult([], ["The file is empty."]);

        var errors = new List<string>();
        var header = records[0];
        var indexes = new Dictionary<string, int>(StringComparer.Ordinal);
        for (var i = 0; i < header.Fields.Count; i++)
        {
            var key = header.Fields[i].Trim().ToLowerInvariant();
            if (key.Length == 0)
                continue;
            if (!indexes.TryAdd(key, i))
                errors.Add($"Column '{header.Fields[i]}' is duplicated.");
        }

        foreach (var required in RequiredHeaders)
        {
            if (!indexes.ContainsKey(required))
                errors.Add($"Missing column '{HeaderLabels[required]}'.");
        }

        if (errors.Count > 0)
            return new LotCsvParseResult([], errors);

        var rows = new List<LotCsvRow>();
        var seen = new Dictionary<int, int>();
        foreach (var record in records.Skip(1))
        {
            if (!TryReadRow(record, indexes, out var row, out var error))
            {
                errors.Add(error!);
                continue;
            }

            if (seen.TryGetValue(row.LotNumber, out var firstLine))
            {
                errors.Add($"Lot number {row.LotNumber} is duplicated on lines {firstLine} and {record.LineNumber}.");
                continue;
            }

            seen[row.LotNumber] = record.LineNumber;
            rows.Add(row);
        }

        if (rows.Count == 0 && errors.Count == 0)
            errors.Add("The file has no lot rows.");

        return new LotCsvParseResult(rows, errors);
    }

    private static bool TryReadRow(
        CsvRecord record,
        IReadOnlyDictionary<string, int> indexes,
        out LotCsvRow row,
        out string? error)
    {
        row = null!;
        if (indexes.Values.Any(index => index >= record.Fields.Count))
        {
            error = $"Line {record.LineNumber} does not have enough columns.";
            return false;
        }

        var lotRaw = Field(record, indexes, "lotnumber");
        var bagsRaw = Field(record, indexes, "bags");
        var weightRaw = Field(record, indexes, "netweightkg");
        var valuationRaw = Field(record, indexes, "valuationperkg");

        if (!int.TryParse(lotRaw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var lotNumber))
        {
            error = $"Line {record.LineNumber}: lotNumber '{lotRaw}' is not a whole number.";
            return false;
        }

        if (!int.TryParse(bagsRaw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var bags))
        {
            error = $"Line {record.LineNumber}: bags '{bagsRaw}' is not a whole number.";
            return false;
        }

        if (!decimal.TryParse(weightRaw, NumberStyles.Number, CultureInfo.InvariantCulture, out var netWeightKg))
        {
            error = $"Line {record.LineNumber}: netWeightKg '{weightRaw}' is not a number.";
            return false;
        }

        decimal? valuation = null;
        if (!string.IsNullOrWhiteSpace(valuationRaw))
        {
            if (!decimal.TryParse(valuationRaw, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsedValuation))
            {
                error = $"Line {record.LineNumber}: valuationPerKg '{valuationRaw}' is not a number.";
                return false;
            }

            valuation = parsedValuation;
        }

        row = new LotCsvRow(
            record.LineNumber,
            lotNumber,
            Optional(record, indexes, "factorycode"),
            Field(record, indexes, "gardenmark"),
            Field(record, indexes, "invoicenumber"),
            Field(record, indexes, "grade"),
            bags,
            string.IsNullOrWhiteSpace(Optional(record, indexes, "packagetype"))
                ? "B"
                : Optional(record, indexes, "packagetype"),
            OptionalDecimal(record, indexes, "netperbagkg"),
            netWeightKg,
            Optional(record, indexes, "sellingmark"),
            Optional(record, indexes, "warehouseorbasis"),
            Optional(record, indexes, "category"),
            valuation,
            string.Join(",", record.Fields));
        error = null;
        return true;
    }

    private static string Optional(CsvRecord record, IReadOnlyDictionary<string, int> indexes, string name) =>
        indexes.TryGetValue(name, out var index) && index < record.Fields.Count ? record.Fields[index] : "";

    private static decimal? OptionalDecimal(CsvRecord record, IReadOnlyDictionary<string, int> indexes, string name)
    {
        var raw = Optional(record, indexes, name);
        if (string.IsNullOrWhiteSpace(raw)) return null;
        return decimal.TryParse(raw, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed) ? parsed : null;
    }

    private static string Field(CsvRecord record, IReadOnlyDictionary<string, int> indexes, string name) =>
        record.Fields[indexes[name]];

    private static List<CsvRecord> ReadRecords(string text)
    {
        var records = new List<CsvRecord>();
        var fields = new List<string>();
        var field = new StringBuilder();
        var inQuotes = false;
        var line = 1;
        var recordLine = 1;
        var sawField = false;

        void EndField()
        {
            fields.Add(field.ToString().Trim());
            field.Clear();
            sawField = true;
        }

        void EndRecord()
        {
            EndField();
            if (fields.Any(value => value.Length > 0))
                records.Add(new CsvRecord(recordLine, fields.ToList()));
            fields = [];
            sawField = false;
        }

        for (var i = 0; i < text.Length; i++)
        {
            var ch = text[i];
            if (inQuotes)
            {
                if (ch == '"')
                {
                    if (i + 1 < text.Length && text[i + 1] == '"')
                    {
                        field.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    if (ch == '\n')
                        line++;
                    field.Append(ch);
                }

                continue;
            }

            switch (ch)
            {
                case '"':
                    inQuotes = true;
                    break;
                case ',':
                    EndField();
                    break;
                case '\r':
                    break;
                case '\n':
                    EndRecord();
                    line++;
                    recordLine = line;
                    break;
                default:
                    field.Append(ch);
                    break;
            }
        }

        if (field.Length > 0 || sawField)
            EndRecord();

        return records;
    }

    private readonly record struct CsvRecord(int LineNumber, IReadOnlyList<string> Fields);
}
