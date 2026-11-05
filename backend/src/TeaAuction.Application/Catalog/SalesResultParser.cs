using System.Data;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using ExcelDataReader;
using TeaAuction.Application.Abstractions;
using TeaAuction.Domain;

namespace TeaAuction.Application.Catalog;

/// <summary>
/// Post-auction sales files. Prefer matching columns by header name
/// (Lot / Buyer / Price / Sold…); fall back to broker fixed-width text dialects.
/// </summary>
public sealed class SalesResultParser : ISalesResultParser
{
    private static readonly string[] LotHeaders = ["lot", "lotno", "lotnumber", "lot#", "lot_no", "lot no", "brokerlot", "lot no."];
    private static readonly string[] PriceHeaders =
    [
        "sold", "soldprice", "soldperkg", "price", "priceperkg", "saleprice", "realized", "proceeds", "lkr", "rate"
    ];
    private static readonly string[] BuyerHeaders = ["buyer", "buyercode", "buyerid", "purchaser", "client", "account"];

    static SalesResultParser()
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
    }

    public SalesResultParseResult Parse(BrokerCode broker, string fileName, Stream content)
    {
        if (CatalogueFileKinds.IsExcel(fileName) || CatalogueFileKinds.IsCsv(fileName))
            return ParseByHeaders(fileName, content);

        return ParseTextDialect(broker, content);
    }

    private static SalesResultParseResult ParseByHeaders(string fileName, Stream content)
    {
        using var buffer = new MemoryStream();
        content.CopyTo(buffer);
        buffer.Position = 0;

        DataTable table;
        try
        {
            table = CatalogueFileKinds.IsCsv(fileName)
                ? ReadCsvTable(buffer)
                : ReadExcelTable(buffer);
        }
        catch (Exception exception)
        {
            return new SalesResultParseResult([], [$"Could not read sales file: {exception.Message}"]);
        }

        if (table.Rows.Count == 0)
            return new SalesResultParseResult([], ["The sales file has no rows."]);

        var headerRowIndex = FindHeaderRow(table);
        if (headerRowIndex < 0)
            return new SalesResultParseResult([], ["Could not find a header row with Lot / Buyer / Price columns."]);

        var headers = table.Rows[headerRowIndex].ItemArray
            .Select(value => NormalizeHeader(value?.ToString() ?? ""))
            .ToList();

        var lotCol = FindColumn(headers, LotHeaders);
        var priceCol = FindColumn(headers, PriceHeaders);
        var buyerCol = FindColumn(headers, BuyerHeaders);

        if (lotCol < 0)
            return new SalesResultParseResult([], ["Header row is missing a Lot column."]);
        if (priceCol < 0 && buyerCol < 0)
            return new SalesResultParseResult([], ["Header row needs a Sold/Price and/or Buyer column."]);

        var rows = new List<SalesResultRow>();
        var errors = new List<string>();
        var seen = new HashSet<int>();

        for (var r = headerRowIndex + 1; r < table.Rows.Count; r++)
        {
            var lineNo = r + 1;
            var cells = table.Rows[r].ItemArray.Select(value => value?.ToString()?.Trim() ?? "").ToArray();
            if (cells.All(string.IsNullOrWhiteSpace))
                continue;

            var lotRaw = Cell(cells, lotCol);
            if (!TryInt(lotRaw, out var lotNumber) || lotNumber <= 0)
            {
                errors.Add($"Line {lineNo}: lot '{lotRaw}' is not a whole number.");
                continue;
            }

            if (!seen.Add(lotNumber))
            {
                errors.Add($"Line {lineNo}: lot {lotNumber} is duplicated.");
                continue;
            }

            decimal? price = null;
            if (priceCol >= 0)
            {
                var priceRaw = Cell(cells, priceCol);
                if (!string.IsNullOrWhiteSpace(priceRaw))
                {
                    if (!TryDec(priceRaw, out var parsedPrice))
                    {
                        errors.Add($"Line {lineNo}: price '{priceRaw}' is not a number.");
                        continue;
                    }

                    price = parsedPrice;
                }
            }

            var buyer = buyerCol >= 0 ? Cell(cells, buyerCol) : "";
            if (price is null && string.IsNullOrWhiteSpace(buyer))
                continue;

            rows.Add(new SalesResultRow(lineNo, lotNumber, price, buyer, string.Join(" | ", cells.Where(c => c.Length > 0))));
        }

        if (rows.Count == 0 && errors.Count == 0)
            errors.Add("No sales result rows were found under the headers.");

        return new SalesResultParseResult(rows, errors);
    }

    private static SalesResultParseResult ParseTextDialect(BrokerCode broker, Stream content)
    {
        using var reader = new StreamReader(content, Encoding.Latin1, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
        var lines = reader.ReadToEnd()
            .Replace("\r\n", "\n")
            .Replace('\r', '\n')
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var rows = new List<SalesResultRow>();
        var errors = new List<string>();
        var seen = new HashSet<int>();

        for (var i = 0; i < lines.Length; i++)
        {
            var lineNo = i + 1;
            var line = lines[i];
            if (!TryParseTextSalesLine(broker, line, out var lot, out var price, out var buyer))
            {
                // Skip non-lot noise quietly when other rows succeed.
                continue;
            }

            if (!seen.Add(lot))
            {
                errors.Add($"Line {lineNo}: lot {lot} is duplicated.");
                continue;
            }

            if (price is null && string.IsNullOrWhiteSpace(buyer))
                continue;

            rows.Add(new SalesResultRow(lineNo, lot, price, buyer, line));
        }

        if (rows.Count == 0)
            errors.Add($"No post-auction sales rows could be read for {broker}. Attach the broker sales file if this dialect is new.");

        return new SalesResultParseResult(rows, errors);
    }

    private static bool TryParseTextSalesLine(
        BrokerCode broker,
        string line,
        out int lot,
        out decimal? price,
        out string buyer)
    {
        lot = 0;
        price = null;
        buyer = "";

        // Prefer explicit lot + sold + buyer tokens when present.
        var labeled = Regex.Match(
            line,
            @"\b(?:LOT|Lot)?\s*[#:]?\s*(\d{1,5})\b.*?\b(?:SOLD|PRICE|RATE)?\s*[:=]?\s*([\d]+(?:\.\d+)?)\b.*?\b(?:BUYER|BYR)?\s*[:=]?\s*([A-Z0-9]{2,12})\b",
            RegexOptions.IgnoreCase);
        if (labeled.Success)
        {
            lot = int.Parse(labeled.Groups[1].Value, CultureInfo.InvariantCulture);
            price = decimal.Parse(labeled.Groups[2].Value, CultureInfo.InvariantCulture);
            buyer = labeled.Groups[3].Value.ToUpperInvariant();
            return true;
        }

        return broker switch
        {
            BrokerCode.AS => TryAs(line, out lot, out price, out buyer),
            BrokerCode.FW => TryFw(line, out lot, out price, out buyer),
            BrokerCode.MB => TryMb(line, out lot, out price, out buyer),
            BrokerCode.CT or BrokerCode.LC => TryCtLc(line, out lot, out price, out buyer),
            BrokerCode.JK => TryJk(line, out lot, out price, out buyer),
            BrokerCode.BC => TryBc(line, out lot, out price, out buyer),
            BrokerCode.EB => TryEb(line, out lot, out price, out buyer),
            _ => false
        };
    }

    private static bool TryAs(string line, out int lot, out decimal? price, out string buyer)
    {
        lot = 0; price = null; buyer = "";
        if (!line.StartsWith("AS", StringComparison.OrdinalIgnoreCase) &&
            !line.StartsWith("ASC", StringComparison.OrdinalIgnoreCase))
            return false;

        var match = Regex.Match(
            line,
            @"(?:AS|ASC)\s+\d+\s+\d{2}/\d{2}/\d{4}\s+(\d+)\s+\S+\s+.*?\s+(\d+)\s+[A-Z]\s+[\d.]+\s+([\d.]+)\s+(\S+)\s+",
            RegexOptions.IgnoreCase);
        if (!match.Success) return false;
        lot = int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
        // Group 3 is often total net in catalogue; post-auction files may carry sold in a later money field.
        var money = Regex.Matches(line, @"\b(\d+\.\d{2})\b");
        if (money.Count >= 3 && TryDec(money[^1].Groups[1].Value, out var sold) && sold > 0)
            price = sold;
        var buyerMatch = Regex.Match(line, @"\b([A-Z]{2,6})\s+(?:EX ESTATE|EX-ESTATE|WAREHOUSE)\b", RegexOptions.IgnoreCase);
        if (buyerMatch.Success) buyer = buyerMatch.Groups[1].Value;
        var trailingBuyer = Regex.Match(line, @"\b([A-Z0-9]{2,8})\s*$");
        if (string.IsNullOrEmpty(buyer) && trailingBuyer.Success) buyer = trailingBuyer.Groups[1].Value;
        return lot > 0 && (price is not null || buyer.Length > 0);
    }

    private static bool TryFw(string line, out int lot, out decimal? price, out string buyer)
    {
        lot = 0; price = null; buyer = "";
        if (!line.StartsWith("FW", StringComparison.OrdinalIgnoreCase)) return false;
        if (!int.TryParse(Slice(line, 21, 30), NumberStyles.Integer, CultureInfo.InvariantCulture, out lot) || lot <= 0)
            return false;
        var money = Regex.Matches(line, @"\b(\d+\.\d{2})\b");
        if (money.Count > 0 && TryDec(money[^1].Groups[1].Value, out var sold) && sold > 0)
            price = sold;
        var buyerMatch = Regex.Match(line, @"\b([A-Z]{2,8})\b(?!.*\b(?:EX-ESTATE|EXESTATE|BAGS|BOP|BOPF)\b)");
        if (buyerMatch.Success) buyer = buyerMatch.Groups[1].Value;
        return price is not null || buyer.Length > 0;
    }

    private static bool TryMb(string line, out int lot, out decimal? price, out string buyer)
    {
        lot = 0; price = null; buyer = "";
        if (!int.TryParse(Slice(line, 8, 14), NumberStyles.Integer, CultureInfo.InvariantCulture, out lot) || lot <= 0)
            return false;
        var mark = Slice(line, 82, 87);
        if (mark.Length > 0) buyer = mark;
        if (line.Length >= 125)
        {
            var packed = line[87..Math.Min(125, line.Length)];
            if (packed.Length >= 8 && TryDec((decimal.Parse(packed[^8..], CultureInfo.InvariantCulture) / 100m).ToString(CultureInfo.InvariantCulture), out var sold))
                price = sold;
        }
        return price is not null || buyer.Length > 0;
    }

    private static bool TryCtLc(string line, out int lot, out decimal? price, out string buyer)
    {
        lot = 0; price = null; buyer = "";
        if (!int.TryParse(Slice(line, 22, 26), NumberStyles.Integer, CultureInfo.InvariantCulture, out lot) || lot <= 0)
            return false;
        var money = Regex.Matches(line, @"\b(\d+\.\d{2})\b");
        if (money.Count > 0 && TryDec(money[^1].Groups[1].Value, out var sold) && sold > 0)
            price = sold;
        var mark = Regex.Match(line, @"\b(SPBS|MWPS|MWP|SPB|PS|RTS)\b");
        if (mark.Success) buyer = mark.Groups[1].Value;
        return price is not null || buyer.Length > 0;
    }

    private static bool TryJk(string line, out int lot, out decimal? price, out string buyer)
    {
        lot = 0; price = null; buyer = "";
        if (line.Length < 20) return false;
        if (!int.TryParse(line[..5], NumberStyles.Integer, CultureInfo.InvariantCulture, out lot) || lot <= 0)
            return false;
        var money = Regex.Matches(line, @"(\d+\.\d{2})");
        // JK sales often put realized price among the trailing money fields (non-zero).
        foreach (Match match in money.Cast<Match>().Reverse())
        {
            if (TryDec(match.Groups[1].Value, out var sold) && sold > 0)
            {
                price = sold;
                break;
            }
        }
        var buyerMatch = Regex.Match(line, @"\b([A-Z0-9]{2,10})\s+\d{2}-\d{2}-\d{4}\s*$");
        if (buyerMatch.Success) buyer = buyerMatch.Groups[1].Value;
        return price is not null || buyer.Length > 0;
    }

    private static bool TryBc(string line, out int lot, out decimal? price, out string buyer)
    {
        lot = 0; price = null; buyer = "";
        var lotMatch = Regex.Match(line, @"BC(\d+)", RegexOptions.IgnoreCase);
        if (!lotMatch.Success) return false;
        lot = int.Parse(lotMatch.Groups[1].Value, CultureInfo.InvariantCulture);
        var valuation = Regex.Match(line, @"BC\d+\s+([\d.]+)", RegexOptions.IgnoreCase);
        if (valuation.Success && TryDec(valuation.Groups[1].Value, out var sold) && sold > 0)
            price = sold;
        var buyerMatch = Regex.Match(line, @"\b(MWPS|SPBS|MWP|SPB)\b");
        if (buyerMatch.Success) buyer = buyerMatch.Groups[1].Value;
        return price is not null || buyer.Length > 0;
    }

    private static bool TryEb(string line, out int lot, out decimal? price, out string buyer)
    {
        lot = 0; price = null; buyer = "";
        if (!int.TryParse(Slice(line, 90, 95), NumberStyles.Integer, CultureInfo.InvariantCulture, out lot) || lot <= 0)
            return false;
        var money = Regex.Matches(line, @"(\d+\.\d{2})");
        if (money.Count > 0 && TryDec(money[^1].Groups[1].Value, out var sold) && sold > 0)
            price = sold;
        buyer = Slice(line, 84, 90);
        return price is not null || buyer.Length > 0;
    }

    private static DataTable ReadExcelTable(Stream stream)
    {
        using var reader = ExcelReaderFactory.CreateReader(stream);
        var dataSet = reader.AsDataSet(new ExcelDataSetConfiguration
        {
            ConfigureDataTable = _ => new ExcelDataTableConfiguration { UseHeaderRow = false }
        });
        if (dataSet.Tables.Count == 0)
            throw new InvalidOperationException("Workbook has no sheets.");
        return dataSet.Tables[0];
    }

    private static DataTable ReadCsvTable(Stream stream)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
        var table = new DataTable();
        var first = true;
        while (reader.ReadLine() is { } line)
        {
            var fields = SplitCsv(line);
            if (first)
            {
                for (var i = 0; i < Math.Max(fields.Count, 1); i++)
                    table.Columns.Add($"C{i}");
                first = false;
            }

            while (table.Columns.Count < fields.Count)
                table.Columns.Add($"C{table.Columns.Count}");

            var row = table.NewRow();
            for (var i = 0; i < fields.Count; i++)
                row[i] = fields[i];
            table.Rows.Add(row);
        }

        return table;
    }

    private static int FindHeaderRow(DataTable table)
    {
        var limit = Math.Min(table.Rows.Count, 40);
        var bestIndex = -1;
        var bestScore = 0;
        for (var r = 0; r < limit; r++)
        {
            var headers = table.Rows[r].ItemArray.Select(value => NormalizeHeader(value?.ToString() ?? "")).ToList();
            var score = 0;
            if (FindColumn(headers, LotHeaders) >= 0) score += 3;
            if (FindColumn(headers, PriceHeaders) >= 0) score += 2;
            if (FindColumn(headers, BuyerHeaders) >= 0) score += 2;
            if (score > bestScore)
            {
                bestScore = score;
                bestIndex = r;
            }
        }

        return bestScore >= 3 ? bestIndex : -1;
    }

    private static int FindColumn(IReadOnlyList<string> headers, IEnumerable<string> candidates)
    {
        foreach (var candidate in candidates)
        {
            for (var i = 0; i < headers.Count; i++)
            {
                var header = headers[i];
                if (header == candidate || header.Contains(candidate, StringComparison.Ordinal))
                    return i;
            }
        }

        return -1;
    }

    private static string NormalizeHeader(string value)
    {
        var trimmed = value.Trim().ToLowerInvariant();
        return Regex.Replace(trimmed, @"[\s_\-./#]+", "");
    }

    private static string Cell(IReadOnlyList<string> cells, int index) =>
        index >= 0 && index < cells.Count ? cells[index] : "";

    private static string Slice(string line, int start, int end) =>
        line.Length <= start ? "" : line[start..Math.Min(end, line.Length)].Trim();

    private static bool TryInt(string raw, out int value) =>
        int.TryParse(raw.Replace(",", "", StringComparison.Ordinal), NumberStyles.Integer, CultureInfo.InvariantCulture, out value);

    private static bool TryDec(string raw, out decimal value) =>
        decimal.TryParse(raw.Replace(",", "", StringComparison.Ordinal), NumberStyles.Number, CultureInfo.InvariantCulture, out value);

    private static List<string> SplitCsv(string line)
    {
        var fields = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (inQuotes)
            {
                if (ch == '"' && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else if (ch == '"')
                {
                    inQuotes = false;
                }
                else
                {
                    current.Append(ch);
                }
            }
            else if (ch == '"')
            {
                inQuotes = true;
            }
            else if (ch == ',')
            {
                fields.Add(current.ToString().Trim());
                current.Clear();
            }
            else
            {
                current.Append(ch);
            }
        }

        fields.Add(current.ToString().Trim());
        return fields;
    }
}
