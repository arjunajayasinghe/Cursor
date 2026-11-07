using System.Data;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using ExcelDataReader;
using TeaAuction.Application.Abstractions;
using TeaAuction.Domain;

namespace TeaAuction.Application.Catalog;

/// <summary>
/// Post-auction sales files. Match Lot / Buyer / Price by header when present;
/// otherwise use broker fixed-width / packed dialects. Same lot may appear with
/// different prices — later rows win; duplicates are not rejected.
/// </summary>
public sealed class SalesResultParser : ISalesResultParser
{
    private static readonly string[] LotHeaders = ["lot", "lotno", "lotnumber", "lot#", "lot_no", "lot no", "brokerlot", "lot no."];
    private static readonly string[] PriceHeaders =
    [
        "sold", "soldprice", "soldperkg", "price", "priceperkg", "saleprice", "realized", "proceeds", "rate"
    ];
    private static readonly string[] BuyerHeaders = ["buyer", "buyercode", "buyerid", "purchaser", "client", "account"];

    static SalesResultParser()
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
    }

    public SalesResultParseResult Parse(BrokerCode broker, string fileName, Stream content)
    {
        if (CatalogueFileKinds.IsExcel(fileName) || CatalogueFileKinds.IsCsv(fileName))
            return ParseTabular(fileName, content);

        return ParseTextDialect(broker, content);
    }

    private static SalesResultParseResult ParseTabular(string fileName, Stream content)
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
        if (headerRowIndex >= 0)
            return ParseHeaderTable(table, headerRowIndex);

        if (LooksLikeHeaderlessSales(table))
            return ParseHeaderlessSales(table);

        return new SalesResultParseResult([], ["Could not find a header row with Lot / Buyer / Price columns."]);
    }

    private static SalesResultParseResult ParseHeaderTable(DataTable table, int headerRowIndex)
    {
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

        var rows = new Dictionary<int, SalesResultRow>();
        var errors = new List<string>();

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

            decimal? price = null;
            if (priceCol >= 0)
            {
                var priceRaw = Cell(cells, priceCol);
                if (!string.IsNullOrWhiteSpace(priceRaw) && TryDec(priceRaw, out var parsedPrice))
                    price = parsedPrice;
            }

            var buyer = buyerCol >= 0 ? Cell(cells, buyerCol) : "";
            if (IsUnsold(price, buyer))
            {
                rows[lotNumber] = new SalesResultRow(lineNo, lotNumber, null, "", string.Join(" | ", cells.Where(c => c.Length > 0)));
                continue;
            }

            rows[lotNumber] = new SalesResultRow(
                lineNo,
                lotNumber,
                price,
                NormalizeBuyer(buyer),
                string.Join(" | ", cells.Where(c => c.Length > 0)));
        }

        if (rows.Count == 0 && errors.Count == 0)
            errors.Add("No sales result rows were found under the headers.");

        return new SalesResultParseResult(rows.Values.OrderBy(row => row.LotNumber).ToList(), errors);
    }

    /// <summary>
    /// LCB / EB style sheets: lot | grade | garden | … | buyer name | net | price (no header).
    /// </summary>
    private static SalesResultParseResult ParseHeaderlessSales(DataTable table)
    {
        var rows = new Dictionary<int, SalesResultRow>();
        var errors = new List<string>();

        for (var r = 0; r < table.Rows.Count; r++)
        {
            var lineNo = r + 1;
            var cells = table.Rows[r].ItemArray.Select(value => value?.ToString()?.Trim() ?? "").ToArray();
            if (cells.Length == 0 || cells.All(string.IsNullOrWhiteSpace))
                continue;

            if (!TryInt(cells[0], out var lotNumber) || lotNumber <= 0)
            {
                errors.Add($"Line {lineNo}: lot '{cells[0]}' is not a whole number.");
                continue;
            }

            // Typical layout: lot, grade, garden, [blank], buyer name, net, price
            decimal? price = null;
            if (cells.Length >= 7 && TryDec(cells[^1], out var trailingPrice))
                price = trailingPrice;
            else
            {
                for (var i = cells.Length - 1; i >= 1; i--)
                {
                    if (TryDec(cells[i], out var parsed) && parsed >= 0)
                    {
                        price = parsed;
                        break;
                    }
                }
            }

            var buyer = "";
            if (cells.Length >= 5)
            {
                var name = cells[4];
                if (name.Equals("UNSOLD", StringComparison.OrdinalIgnoreCase))
                {
                    buyer = "";
                    price = null;
                }
                else if (name.Length > 0 && !TryDec(name, out _))
                {
                    buyer = name;
                }
            }

            var garden = cells.Length > 2 ? cells[2] : "";
            var grade = cells.Length > 1 ? cells[1] : "";
            decimal? net = null;
            if (cells.Length >= 6 && TryDec(cells[^2], out var netKg))
                net = netKg;

            if (IsUnsold(price, buyer))
            {
                rows[lotNumber] = new SalesResultRow(
                    lineNo, lotNumber, null, "", string.Join(" | ", cells.Where(c => c.Length > 0)), garden, grade, net);
                continue;
            }

            rows[lotNumber] = new SalesResultRow(
                lineNo,
                lotNumber,
                price,
                NormalizeBuyer(buyer),
                string.Join(" | ", cells.Where(c => c.Length > 0)),
                garden,
                grade,
                net);
        }

        if (rows.Count == 0)
            errors.Add("No sales result rows were found in the workbook.");

        return new SalesResultParseResult(rows.Values.OrderBy(row => row.LotNumber).ToList(), errors);
    }

    private static bool LooksLikeHeaderlessSales(DataTable table)
    {
        var sample = Math.Min(table.Rows.Count, 8);
        var ok = 0;
        for (var r = 0; r < sample; r++)
        {
            var cells = table.Rows[r].ItemArray.Select(value => value?.ToString()?.Trim() ?? "").ToArray();
            if (cells.Length < 3)
                continue;
            if (!TryInt(cells[0], out var lot) || lot <= 0)
                continue;
            if (cells.Skip(1).Any(cell => TryDec(cell, out _)))
                ok++;
        }

        return ok >= Math.Min(3, sample);
    }

    private static SalesResultParseResult ParseTextDialect(BrokerCode broker, Stream content)
    {
        using var reader = new StreamReader(content, Encoding.Latin1, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
        var lines = reader.ReadToEnd()
            .Replace("\r\n", "\n")
            .Replace('\r', '\n')
            .Split('\n');

        var rows = new Dictionary<int, SalesResultRow>();
        var errors = new List<string>();

        for (var i = 0; i < lines.Length; i++)
        {
            var lineNo = i + 1;
            var line = lines[i];
            if (string.IsNullOrWhiteSpace(line))
                continue;

            if (!TryParseTextSalesLine(broker, line, out var lot, out var price, out var buyer))
                continue;

            if (IsUnsold(price, buyer))
            {
                rows[lot] = new SalesResultRow(lineNo, lot, null, "", line);
                continue;
            }

            rows[lot] = new SalesResultRow(lineNo, lot, price, NormalizeBuyer(buyer), line);
        }

        if (rows.Count == 0)
            errors.Add($"No post-auction sales rows could be read for {broker}.");

        return new SalesResultParseResult(rows.Values.OrderBy(row => row.LotNumber).ToList(), errors);
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

        return broker switch
        {
            BrokerCode.AS => TryAsc(line, out lot, out price, out buyer),
            BrokerCode.FW => TryFw(line, out lot, out price, out buyer),
            BrokerCode.MB => TryMpb(line, out lot, out price, out buyer),
            BrokerCode.CT or BrokerCode.LC => TryCtb(line, out lot, out price, out buyer),
            BrokerCode.JK => TryJk(line, out lot, out price, out buyer),
            BrokerCode.BC => TryBp(line, out lot, out price, out buyer),
            BrokerCode.EB => TryEbText(line, out lot, out price, out buyer),
            _ => false
        };
    }

    /// <summary>
    /// ASC.txt: sale date cat lot inv factory garden grade net price … buyerCode buyerName
    /// </summary>
    private static bool TryAsc(string line, out int lot, out decimal? price, out string buyer)
    {
        lot = 0; price = null; buyer = "";
        if (line.Length < 110)
            return false;
        if (!TryInt(Slice(line, 17, 22), out lot) || lot <= 0)
            return false;
        if (TryDec(Slice(line, 94, 103), out var sold))
            price = sold;
        buyer = Slice(line, 106, 112);
        return true;
    }

    /// <summary>
    /// BP.txt: … BC0001  1060.00VEN…
    /// </summary>
    private static bool TryBp(string line, out int lot, out decimal? price, out string buyer)
    {
        lot = 0; price = null; buyer = "";
        var match = Regex.Match(line, @"BC0*(\d+)\s+(\d+\.\d{2})([A-Z]{0,6})", RegexOptions.IgnoreCase);
        if (!match.Success)
            return false;
        lot = int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
        price = decimal.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture);
        var rawBuyer = match.Groups[3].Value;
        // Buyer code is glued to the name (VENVENTURE → VEN). Keep 2–4 leading letters.
        buyer = rawBuyer.Length <= 4 ? rawBuyer : rawBuyer[..Math.Min(3, rawBuyer.Length)];
        if (rawBuyer.Length >= 2 && rawBuyer.Length <= 4)
            buyer = rawBuyer;
        else if (rawBuyer.Length > 4)
            buyer = GuessGluedBuyer(rawBuyer);
        return lot > 0;
    }

    private static string GuessGluedBuyer(string raw)
    {
        // Prefer 3-char codes used by Bartleet sales (VEN, RTP, …); fall back to 2.
        if (raw.Length >= 3)
            return raw[..3];
        return raw;
    }

    /// <summary>
    /// CTB.txt: lot at cols 5–10, packed net/price at fixed tail, buyer code then name.
    /// </summary>
    private static bool TryCtb(string line, out int lot, out decimal? price, out string buyer)
    {
        lot = 0; price = null; buyer = "";
        if (line.Length < 102)
            return false;
        if (!TryInt(Slice(line, 4, 10), out lot) || lot <= 0)
            return false;

        if (TryInt(Slice(line, 95, 102), out var packedPrice))
            price = packedPrice / 100m;
        buyer = Slice(line, 103, 107);
        return true;
    }

    /// <summary>
    /// FW priced catalogue: … INV  LOT  PRICE  BUYER CODE  BUYER NAME
    /// </summary>
    private static bool TryFw(string line, out int lot, out decimal? price, out string buyer)
    {
        lot = 0; price = null; buyer = "";
        var trimmed = line.TrimStart();
        if (!trimmed.StartsWith("MF", StringComparison.OrdinalIgnoreCase))
            return false;

        var matches = Regex.Matches(line, @"(\d{1,5})\s+(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})\s+([A-Z0-9]{2,6})(?:\s+|$)");
        if (matches.Count == 0)
            return false;

        // Last match is lot/price/buyer; earlier decimals are net weight.
        var match = matches[^1];
        lot = int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
        if (!TryDec(match.Groups[2].Value, out var sold))
            return false;
        price = sold;
        buyer = match.Groups[3].Value;
        return lot > 0;
    }

    /// <summary>
    /// JK.txt packed: sale+lot … net(9) price(10) buyer(4) name
    /// </summary>
    private static bool TryJk(string line, out int lot, out decimal? price, out string buyer)
    {
        lot = 0; price = null; buyer = "";
        if (line.Length < 40)
            return false;
        if (!TryInt(Slice(line, 2, 7), out lot) || lot <= 0)
            return false;

        // Prefer the trailing net/price/buyer block (ignore sale/date digits earlier on the line).
        var matches = Regex.Matches(line, @"(\d{9})(\d{10})([A-Z0-9]{2,4})");
        if (matches.Count == 0)
            return false;
        var match = matches[^1];
        if (TryDec((decimal.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture) / 100m).ToString(CultureInfo.InvariantCulture), out var sold))
            price = sold;
        buyer = match.Groups[3].Value;
        return true;
    }

    /// <summary>
    /// MPB.txt: … invoice  lot  price  buyerCode buyerName …
    /// </summary>
    private static bool TryMpb(string line, out int lot, out decimal? price, out string buyer)
    {
        lot = 0; price = null; buyer = "";
        if (!line.TrimStart().StartsWith("MF", StringComparison.OrdinalIgnoreCase))
            return false;

        var match = Regex.Match(line, @"\b(\d{3,5})\s+(\d{1,5})\s+(\d+\.\d{2})\s+([A-Z0-9]{0,4})\s");
        if (!match.Success)
            return false;
        lot = int.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture);
        price = decimal.Parse(match.Groups[3].Value, CultureInfo.InvariantCulture);
        buyer = match.Groups[4].Value;
        return lot > 0;
    }

    private static bool TryEbText(string line, out int lot, out decimal? price, out string buyer)
    {
        // Prefer Excel for EB; keep a soft text fallback.
        lot = 0; price = null; buyer = "";
        var match = Regex.Match(line, @"^\s*(\d{1,5})\b.*?\b(\d+\.\d{2})\b.*?([A-Z0-9]{2,6})\b");
        if (!match.Success)
            return false;
        lot = int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
        price = decimal.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture);
        buyer = match.Groups[3].Value;
        return lot > 0;
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

    private static string NormalizeBuyer(string buyer)
    {
        var trimmed = buyer.Trim();
        if (trimmed.Equals("UNSOLD", StringComparison.OrdinalIgnoreCase))
            return "";
        var normalized = trimmed.ToUpperInvariant();
        return normalized.Length <= 120 ? normalized : normalized[..120];
    }

    private static bool IsUnsold(decimal? price, string buyer) =>
        (price is null or 0) && string.IsNullOrWhiteSpace(buyer);

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
