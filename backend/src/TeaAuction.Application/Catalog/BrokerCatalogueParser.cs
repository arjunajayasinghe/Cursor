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
        for (var i = 0; i < lines.Count; i++)
        {
            var lineNo = i + 1;
            var match = Regex.Match(
                lines[i],
                @"^AS\s+\d+\s+\d{2}/\d{2}/\d{4}\s+(\d+)\s+\S+\s+(.*?)\s{2,}(\S+)\s+(\S+)\s+(\d+)\s+[A-Z]\s+([\d.]+)\s+([\d.]+)\s+");
            if (!match.Success)
            {
                errors.Add($"Line {lineNo}: could not read AS catalogue row.");
                continue;
            }

            rows.Add(Row(
                lineNo,
                int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture),
                match.Groups[2].Value.Trim(),
                match.Groups[3].Value.Trim(),
                match.Groups[4].Value.Trim(),
                int.Parse(match.Groups[5].Value, CultureInfo.InvariantCulture),
                Dec(match.Groups[7].Value)!.Value));
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
                var garden = Slice(line, 39, 66);
                var invoice = Slice(line, 66, 72);
                var grade = Slice(line, 75, 90);
                var bags = int.Parse(Regex.Match(Slice(line, 92, 96), @"^\d+").Value, CultureInfo.InvariantCulture);
                var totalSlice = prefix == "CT" ? Slice(line, 117, 126) : Slice(line, 119, 128);
                var total = Dec(totalSlice) ?? bags * (Dec(Slice(line, 97, 103)) ?? 0m);
                rows.Add(Row(lineNo, lot, garden, invoice, grade, bags, total));
            }
            catch
            {
                errors.Add($"Line {lineNo}: could not read {prefix} catalogue row.");
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
                rows.Add(Row(
                    lineNo,
                    int.Parse(Slice(line, 21, 30), CultureInfo.InvariantCulture),
                    Slice(line, 40, 72),
                    Slice(line, 72, 81),
                    Slice(line, 81, 95),
                    int.Parse(Slice(line, 95, 100), CultureInfo.InvariantCulture),
                    Dec(Slice(line, 114, 124))!.Value));
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
                var nums = line.Length >= 125 ? line[87..125] : line[87..];
                var invoice = Slice(line, 60, 68).TrimStart('0');
                rows.Add(Row(
                    lineNo,
                    int.Parse(Slice(line, 8, 14), CultureInfo.InvariantCulture),
                    Slice(line, 30, 60),
                    string.IsNullOrEmpty(invoice) ? "0" : invoice,
                    Slice(line, 68, 77),
                    int.Parse(nums[..5], CultureInfo.InvariantCulture),
                    decimal.Parse(nums[^8..], CultureInfo.InvariantCulture) / 100m));
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
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var lineNo = i + 1;
            try
            {
                var qty = Regex.Match(line[34..48], @"(\d+)[A-Za-z]+([\d.]+)");
                var bags = int.Parse(qty.Groups[1].Value, CultureInfo.InvariantCulture);
                var net = Dec(qty.Groups[2].Value)!.Value;
                var gradeMatch = Regex.Match(line[48..84], @"\s*\d*([A-Za-z][A-Za-z0-9]*)");
                var invTot = line[96..Math.Min(112, line.Length)].Replace(" ", "");
                var invMatch = Regex.Match(invTot, @"^(\S+?)(\d+\.\d{2})$");
                var total = invMatch.Success ? Dec(invMatch.Groups[2].Value)!.Value : bags * net;
                var invoice = invMatch.Success ? invMatch.Groups[1].Value : invTot;
                rows.Add(Row(
                    lineNo,
                    int.Parse(Slice(line, 90, 95), CultureInfo.InvariantCulture),
                    Slice(line, 9, 34),
                    invoice,
                    gradeMatch.Success ? gradeMatch.Groups[1].Value : "UNK",
                    bags,
                    total));
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
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var lineNo = i + 1;
            try
            {
                var token = Regex.Matches(line, @"\b([A-Z][A-Z0-9]{1,12})\s+([\d.]+)B\b");
                if (token.Count == 0) throw new FormatException("grade");
                var last = token[^1];
                var grade = last.Groups[1].Value;
                var bags = (int)decimal.Parse(last.Groups[2].Value, CultureInfo.InvariantCulture);
                var after = line[last.Index..];
                var nums = Regex.Match(after, @"B\s+([\d.]+)\s+([\d.]+)");
                var totalText = nums.Groups[2].Value;
                var glued = Regex.Match(totalText, @"^([\d.]+?)(20\d{2})$");
                var total = glued.Success ? Dec(glued.Groups[1].Value)!.Value : Dec(totalText)!.Value;
                var lotMatch = Regex.Match(line, @"BC(\d+)");
                var lot = lotMatch.Success ? int.Parse(lotMatch.Groups[1].Value, CultureInfo.InvariantCulture) : lineNo;
                var invoiceMatch = Regex.Match(line, @"20\d{2}\s+(\d+)");
                var invoice = invoiceMatch.Success ? invoiceMatch.Groups[1].Value : lot.ToString(CultureInfo.InvariantCulture);
                rows.Add(Row(lineNo, lot, Slice(line, 14, 52), invoice, grade, bags, total));
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
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var lineNo = i + 1;
            try
            {
                var invGrade = line[38..64];
                var invMatch = Regex.Match(invGrade, @"^(\S+?)\s*(\d{3})([A-Za-z][A-Za-z0-9]*)");
                var weights = Regex.Match(line, @"(\d+\.\d{2})\s+(\d+)\s+(\d+\.\d{2})B");
                if (!weights.Success) throw new FormatException("weights");
                rows.Add(Row(
                    lineNo,
                    int.Parse(line[..5], CultureInfo.InvariantCulture),
                    Slice(line, 14, 38),
                    invMatch.Success ? invMatch.Groups[1].Value : Slice(line, 38, 44),
                    invMatch.Success ? invMatch.Groups[3].Value : Slice(line, 47, 64),
                    int.Parse(weights.Groups[2].Value, CultureInfo.InvariantCulture),
                    Dec(weights.Groups[1].Value)!.Value));
            }
            catch
            {
                errors.Add($"Line {lineNo}: could not read JK catalogue row.");
            }
        }

        return Finish(rows, errors);
    }

    private static LotCsvRow Row(int line, int lot, string garden, string invoice, string grade, int bags, decimal totalNetKg) =>
        new(line, lot, garden.Trim(), invoice.Trim(), NormalizeGrade(grade), bags, totalNetKg, null);

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
}
