using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using TeaAuction.Domain;
using UglyToad.PdfPig;

namespace TeaAuction.Application.Catalog;

public sealed class PurchasedInvoicePdfParser : IPurchasedInvoicePdfParser
{
    private static readonly Regex BuyerLine = new(
        @"BUYER\s*:?\s*([A-Z0-9]+)\s*\|\s*(.+?)(?:\s{2,}DATE OF SALE|\s*$)",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Singleline);

    private static readonly Regex BuyerNameOnly = new(
        @"NAME OF BUYER\s*:?\s*(.+)",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex DateOfSale = new(
        @"DATE OF SALE\s*:?\s*([0-9]{1,2}[/.\-][0-9]{1,2}[/.\-][0-9]{2,4}|[0-9]{1,2}-[A-Za-z]{3}-[0-9]{4})",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex DateOfSaleAlt = new(
        @"Date of Sale\s*:?\s*([0-9]{1,2}-[A-Za-z]{3}-[0-9]{4}|[0-9]{1,2}/[0-9]{1,2}/[0-9]{4})",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex ContractNo = new(
        @"CONTRACT NO\s*:?\s*(\S+)",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex ContractSale = new(
        @"/(\d{4})/0*(\d{1,3})/",
        RegexOptions.CultureInvariant);

    private static readonly Regex LotLine = new(
        @"^\s*(\d{1,4})\s+([A-Z0-9][A-Z0-9 ""'./&\-]{1,40}?)\s{2,}.*?([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$",
        RegexOptions.CultureInvariant);

    private static readonly Regex LotLineLoose = new(
        @"^\s*(\d{1,4})\s+([A-Z0-9][A-Z0-9 ""'./&\-]*)\s+.*?([\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?(?:\s+([\d,]+\.\d{2}))?(?:\s+([\d,]+\.\d{2}))?\s*$",
        RegexOptions.CultureInvariant);

    private static readonly Regex GradeToken = new(
        @"\b(BOPFEXSP1|BOPFEXSP|FBOPFEXSP1|FBOPF1|FBOPFSP|FBOPF|FBOP|BOPF1|BOPA|BOPSP|BOP1|BOPF|BOP|PEK1|PEK|OPA|OP1|OP|PF1|BP1|DUST1|DUST|FGS1|FGS|UST1|UST)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex InvoiceToken = new(
        @"\b(\d{3,5}R?)\b",
        RegexOptions.CultureInvariant);

    public PurchasedInvoiceParseResult Parse(BrokerCode broker, Stream content)
    {
        string text;
        try
        {
            text = ExtractText(content);
        }
        catch (Exception ex)
        {
            return new PurchasedInvoiceParseResult("", "", "", null, null, null, null, null, null, null, [],
                [$"Could not read PDF: {ex.Message}"]);
        }

        if (string.IsNullOrWhiteSpace(text))
            return new PurchasedInvoiceParseResult("", "", "", null, null, null, null, null, null, null, [],
                ["The PDF has no extractable text."]);

        var normalized = text.Replace("\r\n", "\n").Replace('\r', '\n');
        var buyerCode = "";
        var buyerName = "";
        var buyer = BuyerLine.Match(normalized);
        if (buyer.Success)
        {
            buyerCode = buyer.Groups[1].Value.Trim();
            buyerName = CleanSpaces(buyer.Groups[2].Value);
        }
        else
        {
            var nameOnly = BuyerNameOnly.Match(normalized);
            if (nameOnly.Success)
                buyerName = CleanSpaces(nameOnly.Groups[1].Value);
        }

        if (string.IsNullOrWhiteSpace(buyerName) && normalized.Contains("VENTURE", StringComparison.OrdinalIgnoreCase))
            buyerName = "VENTURE TEA";

        var dateMatch = DateOfSale.Match(normalized);
        if (!dateMatch.Success) dateMatch = DateOfSaleAlt.Match(normalized);
        DateOnly? saleDate = dateMatch.Success ? ParseDate(dateMatch.Groups[1].Value) : null;

        var contract = ContractNo.Match(normalized).Success
            ? ContractNo.Match(normalized).Groups[1].Value.Trim()
            : "";
        string? saleFromContract = null;
        int? yearFromContract = null;
        var cs = ContractSale.Match(contract);
        if (cs.Success)
        {
            yearFromContract = int.Parse(cs.Groups[1].Value, CultureInfo.InvariantCulture);
            saleFromContract = cs.Groups[2].Value.TrimStart('0');
            if (string.IsNullOrEmpty(saleFromContract)) saleFromContract = "0";
        }

        var lots = ParseLots(normalized, broker);
        var errors = new List<string>();
        if (lots.Count == 0)
            errors.Add("No purchased lot rows could be read from the PDF.");

        var (kg, proceeds, vat, payable) = ParseTotals(normalized);

        return new PurchasedInvoiceParseResult(
            buyerCode,
            buyerName,
            contract,
            saleDate,
            saleFromContract,
            yearFromContract,
            kg,
            proceeds,
            vat,
            payable,
            lots,
            errors);
    }

    private static List<PurchasedInvoiceLotRow> ParseLots(string text, BrokerCode broker)
    {
        var rows = new Dictionary<int, PurchasedInvoiceLotRow>();
        foreach (var raw in text.Split('\n'))
        {
            var line = raw.TrimEnd();
            if (line.Length < 20) continue;
            if (!Regex.IsMatch(line, @"^\s*\d{1,4}\s+[A-Z0-9]")) continue;
            if (line.Contains("Lot", StringComparison.OrdinalIgnoreCase) && line.Contains("Mark", StringComparison.OrdinalIgnoreCase))
                continue;

            var money = Regex.Matches(line, @"[\d,]+\.\d{2}")
                .Select(m => Dec(m.Value))
                .Where(v => v.HasValue)
                .Select(v => v!.Value)
                .ToList();
            if (money.Count < 2) continue;

            var lotMatch = Regex.Match(line, @"^\s*(\d{1,4})\b");
            if (!lotMatch.Success) continue;
            var lot = int.Parse(lotMatch.Groups[1].Value, CultureInfo.InvariantCulture);
            if (lot <= 0 || lot > 20000) continue;

            // Heuristic: last 4 money fields ≈ price, proceeds, vat, proceed+vat (or last 2 for sparse)
            decimal price, proceeds, vat = 0, withVat = 0, netKg = 0;
            if (money.Count >= 4)
            {
                // Prefer trailing quartet when proceeds look large
                var slice = money[^4..];
                if (slice[1] >= 1000 || slice[3] >= 1000)
                {
                    price = slice[0];
                    proceeds = slice[1];
                    vat = slice[2];
                    withVat = slice[3];
                    // net kg often earlier as a modest decimal
                    netKg = money.FirstOrDefault(v => v is >= 50 and < 20000 && v != price) is var n and > 0 ? n : 0;
                    if (netKg == 0 && money.Count >= 5)
                        netKg = money[^5];
                }
                else
                {
                    price = money[^2];
                    proceeds = money[^1];
                }
            }
            else if (money.Count == 3)
            {
                price = money[0];
                proceeds = money[1];
                withVat = money[2];
            }
            else
            {
                price = money[0];
                proceeds = money[1];
            }

            // Skip header-ish tiny prices without proceeds
            if (proceeds < 100 && price < 100) continue;

            var markMatch = Regex.Match(line, @"^\s*\d{1,4}\s+([A-Z0-9][A-Z0-9 ""'./&\-]{1,40}?)(?:\s{2,}|\s+[A-Z][a-z])");
            var mark = markMatch.Success ? CleanSpaces(markMatch.Groups[1].Value) : "";
            var gradeMatch = GradeToken.Matches(line);
            var grade = gradeMatch.Count > 0 ? gradeMatch[^1].Value.ToUpperInvariant() : "";
            var invMatches = InvoiceToken.Matches(line);
            var invoice = "";
            foreach (Match inv in invMatches)
            {
                var v = inv.Value;
                if (v == lot.ToString(CultureInfo.InvariantCulture)) continue;
                if (v.Length >= 3) { invoice = v; break; }
            }

            var bagsMatch = Regex.Match(line, @"\b(\d{1,3})\s+(?:B\b|[\d,]+\.\d{2})");
            var bags = bagsMatch.Success ? int.Parse(bagsMatch.Groups[1].Value, CultureInfo.InvariantCulture) : 0;
            if (bags > 200) bags = 0;

            // Seller name / VAT often sit between mark and invoice on the PDF row; capture when present.
            var sellerName = "";
            var sellerVat = "";
            var sellerMatch = Regex.Match(
                line,
                @"^\s*\d{1,4}\s+\S(?:.*?\S)?\s{2,}([A-Z][A-Z0-9 &.'()/,\-]{3,80}?)\s+(\d{5,}-\d+)\s+",
                RegexOptions.IgnoreCase);
            if (sellerMatch.Success)
            {
                sellerName = CleanSpaces(sellerMatch.Groups[1].Value);
                sellerVat = CleanSpaces(sellerMatch.Groups[2].Value);
            }

            rows[lot] = new PurchasedInvoiceLotRow(
                lot,
                mark,
                sellerName,
                sellerVat,
                invoice,
                grade,
                bags,
                bags > 0 && netKg > 0 ? Math.Round(netKg / bags, 2) : null,
                netKg,
                price,
                proceeds,
                vat,
                withVat > 0 ? withVat : proceeds + vat);
        }

        return rows.Values.OrderBy(r => r.LotNumber).ToList();
    }

    private static (decimal? kg, decimal? proceeds, decimal? vat, decimal? payable) ParseTotals(string text)
    {
        var payableMatch = Regex.Match(text, @"Total Amount Payable\s*:?\s*([\d,]+\.\d{2})", RegexOptions.IgnoreCase);
        decimal? payable = payableMatch.Success ? Dec(payableMatch.Groups[1].Value) : null;

        var fw = Regex.Match(text, @"TOTAL PURCHASE:\s+([\d,]+)\s+([\d,]+\.\d{2})", RegexOptions.IgnoreCase);
        if (fw.Success)
            return (Dec(fw.Groups[1].Value + ".00") ?? Dec(fw.Groups[1].Value), Dec(fw.Groups[2].Value), null, payable);

        foreach (var line in text.Split('\n'))
        {
            if (!Regex.IsMatch(line, @"^\s*Total\b", RegexOptions.IgnoreCase) &&
                !line.Contains("Total", StringComparison.OrdinalIgnoreCase))
                continue;
            var nums = Regex.Matches(line, @"[\d,]+\.\d{2}").Select(m => Dec(m.Value)).Where(v => v.HasValue).Select(v => v!.Value).ToList();
            if (nums.Count < 2) continue;
            if (nums[0] < 100_000)
                return (nums[0], nums[1], nums.Count > 2 ? nums[2] : null, payable ?? (nums.Count > 3 ? nums[3] : null));
        }

        return (null, null, null, payable);
    }

    private static string ExtractText(Stream content)
    {
        // Crystal Reports buyer PDFs extract cleanly with poppler when available.
        if (content.CanSeek) content.Position = 0;
        var viaPoppler = TryPdftotext(content);
        if (!string.IsNullOrWhiteSpace(viaPoppler))
            return viaPoppler;

        if (content.CanSeek) content.Position = 0;
        using var document = PdfDocument.Open(content);
        var sb = new StringBuilder();
        foreach (var page in document.GetPages())
        {
            sb.AppendLine(page.Text);
            sb.AppendLine();
        }
        return sb.ToString();
    }

    private static string? TryPdftotext(Stream content)
    {
        try
        {
            var temp = Path.Combine(Path.GetTempPath(), $"tea-inv-{Guid.NewGuid():N}.pdf");
            try
            {
                using (var file = File.Create(temp))
                    content.CopyTo(file);

                var psi = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "pdftotext",
                    Arguments = $"-layout \"{temp}\" -",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false
                };
                using var process = System.Diagnostics.Process.Start(psi);
                if (process is null) return null;
                var output = process.StandardOutput.ReadToEnd();
                process.WaitForExit(15_000);
                return process.ExitCode == 0 ? output : null;
            }
            finally
            {
                try { File.Delete(temp); } catch { /* ignore */ }
            }
        }
        catch
        {
            return null;
        }
    }

    private static DateOnly? ParseDate(string value)
    {
        value = value.Trim();
        string[] formats =
        [
            "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy",
            "dd-MMM-yyyy", "d-MMM-yyyy", "dd/MM/yy", "d/M/yy"
        ];
        if (DateOnly.TryParseExact(value, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            return date;
        if (DateOnly.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out date))
            return date;
        return null;
    }

    private static decimal? Dec(string value) =>
        decimal.TryParse(value.Replace(",", "", StringComparison.Ordinal), NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : null;

    private static string CleanSpaces(string value) =>
        Regex.Replace(value.Trim(), @"\s+", " ");
}
