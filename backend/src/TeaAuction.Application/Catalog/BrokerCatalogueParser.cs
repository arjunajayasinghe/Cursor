using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using TeaAuction.Application.Abstractions;
using TeaAuction.Domain;

namespace TeaAuction.Application.Catalog;

public sealed class BrokerCatalogueParser : IBrokerCatalogueParser
{
    public LotCsvParseResult Parse(BrokerCode broker, Stream content)
    {
        using var reader = new StreamReader(content, Encoding.Latin1, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
        var text = reader.ReadToEnd();
        var lines = text.Replace("\r\n", "\n").Replace('\r', '\n')
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return broker switch
        {
            BrokerCode.AS => ParseAs(lines),
            BrokerCode.CT => ParseCtOrLc(lines, "CT"),
            BrokerCode.LC => ParseCtOrLc(lines, "LC"),
            BrokerCode.FW => ParseFw(lines),
            BrokerCode.MB => ParseMb(lines),
            BrokerCode.EB => ParseEb(lines),
            BrokerCode.BC => ParseBc(lines),
            BrokerCode.JK => ParseJk(lines),
            _ => new LotCsvParseResult([], [$"Broker {broker} is not supported."])
        };
    }

    private static LotCsvParseResult ParseAs(IReadOnlyList<string> lines)
    {
        var rows = new List<LotCsvRow>();
        var errors = new List<string>();
        var pattern = new Regex(
            @"^AS\s+\d+\s+\d{2}/\d{2}/\d{4}\s+(\d+)\s+(\S+)\s+(.*?)\s{2,}(\S+)\s+(\S+)\s+(\d+)\s+([A-Z])\s+([\d.]+)\s+([\d.]+)\s+(\S+)\s+(.*?)\s+(\d+)\s*$",
            RegexOptions.CultureInvariant);

        for (var i = 0; i < lines.Count; i++)
        {
            var lineNo = i + 1;
            var line = lines[i];
            var match = pattern.Match(line);
            if (!match.Success)
            {
                errors.Add($"Line {lineNo}: could not read AS catalogue row.");
                continue;
            }

            rows.Add(Row(
                lineNo,
                int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture),
                match.Groups[2].Value,
                match.Groups[3].Value,
                match.Groups[4].Value,
                match.Groups[5].Value,
                int.Parse(match.Groups[6].Value, CultureInfo.InvariantCulture),
                match.Groups[7].Value,
                Dec(match.Groups[8].Value),
                Dec(match.Groups[9].Value)!.Value,
                match.Groups[10].Value,
                match.Groups[11].Value,
                "",
                null,
                line));
        }

        return Finish(rows, errors);
    }

    private static LotCsvParseResult ParseCtOrLc(IReadOnlyList<string> lines, string prefix)
    {
        var rows = new List<LotCsvRow>();
        var errors = new List<string>();
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var lineNo = i + 1;
            try
            {
                var lot = int.Parse(Slice(line, 22, 26), CultureInfo.InvariantCulture);
                var factory = Slice(line, 28, 38);
                var garden = Slice(line, 39, 66);
                var invoice = Slice(line, 66, 72);
                var grade = prefix == "CT" ? Slice(line, 75, 90) : Slice(line, 73, 88);
                var bagsToken = prefix == "CT" ? Slice(line, 92, 96) : Slice(line, 90, 94);
                var bags = int.Parse(Regex.Match(bagsToken, @"^\d+").Value, CultureInfo.InvariantCulture);
                var packageType = bagsToken.Contains('B', StringComparison.OrdinalIgnoreCase) ? "B" : "BAGS";

                string sellingMark;
                decimal? netPerBag;
                if (prefix == "CT")
                {
                    var netMark = Slice(line, 97, 110);
                    var netMatch = Regex.Match(netMark, @"^([\d.]+)([A-Z]*)");
                    netPerBag = netMatch.Success ? Dec(netMatch.Groups[1].Value) : null;
                    sellingMark = netMatch.Success ? netMatch.Groups[2].Value : "";
                }
                else
                {
                    netPerBag = Dec(Slice(line, 95, 102));
                    sellingMark = Slice(line, 103, 109);
                }

                var totalSlice = prefix == "CT" ? Slice(line, 117, 126) : Slice(line, 117, 126);
                var total = Dec(totalSlice) ?? bags * (netPerBag ?? 0m);
                var warehouse = prefix == "CT" ? Slice(line, 128, 169) : Slice(line, 128, 160);

                if (bags <= 0 || total <= 0 || string.IsNullOrWhiteSpace(garden))
                    continue;

                rows.Add(Row(lineNo, lot, factory, garden, invoice, grade, bags, packageType, netPerBag, total, sellingMark, warehouse, "", null, line));
            }
            catch
            {
                // Skip sparse/odd dialect rows; keep importing the clean catalogue lines.
            }
        }

        return Finish(rows, errors);
    }

    private static LotCsvParseResult ParseFw(IReadOnlyList<string> lines)
    {
        var rows = new List<LotCsvRow>();
        var errors = new List<string>();
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var lineNo = i + 1;
            if (!line.StartsWith("FW", StringComparison.Ordinal))
                continue;

            try
            {
                var bags = int.Parse(Slice(line, 95, 100), CultureInfo.InvariantCulture);
                if (bags <= 0)
                    continue;

                rows.Add(Row(
                    lineNo,
                    int.Parse(Slice(line, 21, 30), CultureInfo.InvariantCulture),
                    Slice(line, 31, 40),
                    Slice(line, 40, 72),
                    Slice(line, 72, 81),
                    Slice(line, 81, 95),
                    bags,
                    Slice(line, 101, 103),
                    Dec(Slice(line, 105, 113)),
                    Dec(Slice(line, 114, 124))!.Value,
                    "",
                    Slice(line, 133, 165),
                    "",
                    null,
                    line));
            }
            catch
            {
                errors.Add($"Line {lineNo}: could not read FW catalogue row.");
            }
        }

        return Finish(rows, errors);
    }

    private static LotCsvParseResult ParseMb(IReadOnlyList<string> lines)
    {
        var rows = new List<LotCsvRow>();
        var errors = new List<string>();
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var lineNo = i + 1;
            try
            {
                var category = Slice(line, 16, 19);
                var factory = (Slice(line, 20, 23) + Slice(line, 23, 29)).Replace(" ", "", StringComparison.Ordinal);
                var garden = Slice(line, 30, 60);
                var invoice = Slice(line, 60, 68).TrimStart('0');
                if (string.IsNullOrEmpty(invoice)) invoice = "0";
                var grade = Slice(line, 68, 77);
                var packageType = Slice(line, 77, 82);
                var sellingMark = Slice(line, 82, 87);
                var nums = line.Length >= 125 ? line[87..125] : line[87..];
                var bags = int.Parse(nums[..5], CultureInfo.InvariantCulture);
                var netPerBag = decimal.Parse(nums[5..10], CultureInfo.InvariantCulture) / 100m;
                var total = decimal.Parse(nums[^8..], CultureInfo.InvariantCulture) / 100m;

                rows.Add(Row(
                    lineNo,
                    int.Parse(Slice(line, 8, 14), CultureInfo.InvariantCulture),
                    factory,
                    garden,
                    invoice,
                    grade,
                    bags,
                    packageType,
                    netPerBag,
                    total,
                    sellingMark,
                    "",
                    category,
                    null,
                    line));
            }
            catch
            {
                errors.Add($"Line {lineNo}: could not read MB catalogue row.");
            }
        }

        return Finish(rows, errors);
    }

    private static LotCsvParseResult ParseEb(IReadOnlyList<string> lines)
    {
        var rows = new List<LotCsvRow>();
        var errors = new List<string>();
        // Dense EB rows: factory + garden + bagsBnet + grade, then mark + lot + invoiceRtotal.
        var bagsNet = new Regex(@"(\d+)B([\d.]+)", RegexOptions.CultureInvariant);
        var markLotInv = new Regex(
            @"(MWP|SPBS|SPB|MWPS|MW-P/S|H-SPBS)\s+(\d+)\s+(\S*?)\s*(\d+\.\d{2})",
            RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);
        var gradeToken = new Regex(@"\d([A-Za-z][A-Za-z0-9]*)", RegexOptions.CultureInvariant);

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var lineNo = i + 1;
            try
            {
                var qty = bagsNet.Match(line);
                if (!qty.Success) throw new FormatException("qty");
                var bags = int.Parse(qty.Groups[1].Value, CultureInfo.InvariantCulture);
                var net = Dec(qty.Groups[2].Value)!.Value;

                var meta = markLotInv.Match(line);
                if (!meta.Success) throw new FormatException("lot");
                var lot = int.Parse(meta.Groups[2].Value, CultureInfo.InvariantCulture);
                var invoice = meta.Groups[3].Value.Trim().TrimEnd('R', 'r');
                var total = Dec(meta.Groups[4].Value)!.Value;
                if (total <= 0) total = bags * net;

                var beforeMark = line[..meta.Index];
                var gradeMatch = gradeToken.Matches(beforeMark);
                var grade = gradeMatch.Count > 0 ? gradeMatch[^1].Groups[1].Value : "UNK";
                var factory = Slice(line, 0, 8);
                var gardenEnd = qty.Index;
                var garden = line[Math.Min(8, gardenEnd)..gardenEnd].Trim();

                rows.Add(Row(
                    lineNo,
                    lot,
                    factory,
                    garden,
                    string.IsNullOrWhiteSpace(invoice) ? lot.ToString(CultureInfo.InvariantCulture) : invoice,
                    grade,
                    bags,
                    "B",
                    net,
                    total,
                    meta.Groups[1].Value.ToUpperInvariant(),
                    "",
                    "",
                    null,
                    line));
            }
            catch
            {
                errors.Add($"Line {lineNo}: could not read EB catalogue row.");
            }
        }

        return Finish(rows, errors);
    }

    private static LotCsvParseResult ParseBc(IReadOnlyList<string> lines)
    {
        var rows = new List<LotCsvRow>();
        var errors = new List<string>();
        // Grade may be glued to a warehouse address (…MUTHURAJAWELAOP1); take the last grade+bags pack.
        var gradeBags = new Regex(
            @"([A-Za-z][A-Za-z0-9]{0,11})\s+(\d+(?:\.\d+)?)B\s+([\d.]+)\s+([\d.]+)",
            RegexOptions.CultureInvariant);

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var lineNo = i + 1;
            if (!Regex.IsMatch(line, @"BC\d+", RegexOptions.CultureInvariant))
                continue;

            try
            {
                var factoryMatch = Regex.Match(line, @"MF\d{3,5}");
                var factory = factoryMatch.Success ? factoryMatch.Value : "";
                var garden = Slice(line, 14, 52);
                var sellingMarkMatch = Regex.Match(line, @"\b(MWPS|SPBS|MWP|SPB|MW-P/S|H-SPBS)\b");
                var sellingMark = sellingMarkMatch.Success ? sellingMarkMatch.Value : "";
                var warehouse = line.Contains("Ex-estate", StringComparison.OrdinalIgnoreCase)
                    ? "Ex-estate Basis"
                    : Slice(line, 80, 120);

                var token = gradeBags.Matches(line);
                if (token.Count == 0) throw new FormatException("grade");
                var last = token[^1];
                var grade = ExtractTrailingGrade(last.Groups[1].Value);
                var bags = (int)decimal.Parse(last.Groups[2].Value, CultureInfo.InvariantCulture);
                var netPerBag = Dec(last.Groups[3].Value);
                var totalText = last.Groups[4].Value;
                var glued = Regex.Match(totalText, @"^([\d.]+?)(20\d{2})$");
                var total = glued.Success ? Dec(glued.Groups[1].Value)!.Value : Dec(totalText)!.Value;
                var lotMatch = Regex.Match(line, @"BC(\d+)");
                var lot = lotMatch.Success ? int.Parse(lotMatch.Groups[1].Value, CultureInfo.InvariantCulture) : lineNo;
                var invoiceMatch = Regex.Match(line, @"20\d{2}\s*R?(\d+)");
                var invoice = invoiceMatch.Success ? invoiceMatch.Groups[1].Value : lot.ToString(CultureInfo.InvariantCulture);
                var valuationMatch = Regex.Match(line, @"BC\d+\s+([\d.]+)");
                decimal? valuation = valuationMatch.Success ? Dec(valuationMatch.Groups[1].Value) : null;

                rows.Add(Row(lineNo, lot, factory, garden, invoice, grade, bags, "B", netPerBag, total, sellingMark, warehouse, "", valuation, line));
            }
            catch
            {
                errors.Add($"Line {lineNo}: could not read BC catalogue row.");
            }
        }

        return Finish(rows, errors);
    }

    private static LotCsvParseResult ParseJk(IReadOnlyList<string> lines)
    {
        var rows = new List<LotCsvRow>();
        var errors = new List<string>();
        var header = new Regex(
            @"^(\d{5})MF\s*(\d+)\s+(.*?)\s{2,}(\S+)\s+(\d{3})([A-Za-z][A-Za-z0-9]*)",
            RegexOptions.CultureInvariant);
        // Bags may be paper (B) or hessian (H).
        var weights = new Regex(
            @"(\d+\.\d{2})\s+(\d+)\s+(\d+\.\d{2})([BH])",
            RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var lineNo = i + 1;
            try
            {
                var head = header.Match(line);
                var pack = weights.Match(line);
                if (!pack.Success) throw new FormatException("weights");

                string factory;
                string garden;
                string invoice;
                string grade;
                int lot;
                if (head.Success)
                {
                    lot = int.Parse(head.Groups[1].Value, CultureInfo.InvariantCulture);
                    factory = "MF" + head.Groups[2].Value;
                    garden = head.Groups[3].Value;
                    invoice = head.Groups[4].Value;
                    grade = head.Groups[6].Value;
                }
                else
                {
                    lot = int.Parse(line[..5], CultureInfo.InvariantCulture);
                    factory = (Slice(line, 5, 8) + Slice(line, 8, 13)).Replace(" ", "", StringComparison.Ordinal);
                    garden = Slice(line, 14, 38);
                    var invGrade = line[38..Math.Min(64, line.Length)];
                    var invMatch = Regex.Match(invGrade, @"^(\S+?)\s*(\d{3})([A-Za-z][A-Za-z0-9]*)");
                    invoice = invMatch.Success ? invMatch.Groups[1].Value : Slice(line, 38, 44);
                    grade = invMatch.Success ? invMatch.Groups[3].Value : Slice(line, 47, 64);
                }

                var warehouse = Slice(line, 64, 90);
                var company = Slice(line, 91, 130);
                var sellingMark = Slice(line, 133, 141);
                var category = line.Contains("Ex-Estate", StringComparison.OrdinalIgnoreCase) ? "Ex-Estate" : "";
                var packageType = pack.Groups[4].Value.ToUpperInvariant();

                rows.Add(Row(
                    lineNo,
                    lot,
                    factory,
                    garden,
                    invoice,
                    grade,
                    int.Parse(pack.Groups[2].Value, CultureInfo.InvariantCulture),
                    packageType,
                    Dec(pack.Groups[3].Value),
                    Dec(pack.Groups[1].Value)!.Value,
                    sellingMark,
                    string.IsNullOrWhiteSpace(warehouse) ? company : warehouse,
                    category,
                    null,
                    line));
            }
            catch
            {
                errors.Add($"Line {lineNo}: could not read JK catalogue row.");
            }
        }

        return Finish(rows, errors);
    }

    private static LotCsvRow Row(
        int line,
        int lot,
        string factory,
        string garden,
        string invoice,
        string grade,
        int bags,
        string packageType,
        decimal? netPerBag,
        decimal totalNetKg,
        string sellingMark,
        string warehouse,
        string category,
        decimal? valuation,
        string sourceLine) =>
        new(
            line,
            lot,
            factory.Trim(),
            garden.Trim(),
            invoice.Trim(),
            NormalizeGrade(grade),
            bags,
            string.IsNullOrWhiteSpace(packageType) ? "B" : packageType.Trim(),
            netPerBag,
            totalNetKg,
            sellingMark.Trim(),
            warehouse.Trim(),
            category.Trim(),
            valuation,
            sourceLine.Trim());

    private static LotCsvParseResult Finish(List<LotCsvRow> rows, List<string> errors)
    {
        if (rows.Count == 0 && errors.Count == 0)
            errors.Add("The file has no lot rows.");
        return new LotCsvParseResult(rows, errors);
    }

    private static string Slice(string line, int start, int end) =>
        line.Length <= start ? "" : line[start..Math.Min(end, line.Length)].Trim();

    private static decimal? Dec(string value) =>
        decimal.TryParse(value.Trim(), NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed) ? parsed : null;

    private static string NormalizeGrade(string grade) => grade.Trim().Trim('.') switch
    {
        "UST" => "DUST",
        "UST1" => "DUST1",
        var value => value
    };

    // Address text is often glued onto the grade (…MUTHURAJAWELAOP1); keep the trailing grade token.
    private static readonly Regex TrailingGrade = new(
        @"(BOPFEXSP1|BOPFEXSP|FBOPFEXSP1|FBOPFEXSP|FBOPF1|FBOPFSP|FBOPF|FBOP|BOPF1|BOPA|BOPSP|BOP1|BOPF|BOP|PEK1|PEK|OPA|OP1|OP|PF1|BP1|DUST1|DUST|UST1|UST)$",
        RegexOptions.CultureInvariant | RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static string ExtractTrailingGrade(string raw)
    {
        var match = TrailingGrade.Match(raw.Trim());
        return match.Success ? match.Value.ToUpperInvariant() : raw.Trim();
    }
}
