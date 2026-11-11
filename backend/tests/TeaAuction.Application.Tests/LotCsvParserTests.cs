using System.Text;
using TeaAuction.Application.Catalog;

namespace TeaAuction.Application.Tests;

public class LotCsvParserTests
{
    private readonly LotCsvParser _parser = new();

    [Fact]
    public void Parse_reads_lots_and_allows_a_blank_valuation()
    {
        const string csv = """
            lotNumber,gardenMark,invoiceNumber,grade,bags,netWeightKg,valuationPerKg
            1,Pedro,PD-1,BOP,20,540.5,1250
            2,"Great Western, Uva",GW-2,Dust1,10,270,
            """;

        var result = _parser.Parse(Stream(csv));

        Assert.Empty(result.Errors);
        Assert.Equal(2, result.Rows.Count);
        Assert.Equal("Pedro", result.Rows[0].GardenMark);
        Assert.Equal(1250m, result.Rows[0].ValuationPerKg);
        Assert.Equal("Great Western, Uva", result.Rows[1].GardenMark);
        Assert.Null(result.Rows[1].ValuationPerKg);
        Assert.Equal(TeaGradeName("Dust1"), result.Rows[1].Grade);
    }

    [Fact]
    public void Parse_reports_a_missing_column()
    {
        const string csv = """
            lotNumber,gardenMark,invoiceNumber,grade,bags,netWeightKg
            1,Pedro,PD-1,BOP,20,540
            """;

        var result = _parser.Parse(Stream(csv));

        Assert.Contains(result.Errors, error => error.Contains("valuationPerKg", StringComparison.Ordinal));
        Assert.Empty(result.Rows);
    }

    [Fact]
    public void Parse_reports_a_bad_weight_and_a_duplicate_lot()
    {
        const string csv = """
            lotNumber,gardenMark,invoiceNumber,grade,bags,netWeightKg,valuationPerKg
            1,Pedro,PD-1,BOP,20,nope,1250
            4,Somerset,SM-1,BOPF,10,100,900
            4,Mattakelle,MT-1,OP,8,80,1000
            """;

        var result = _parser.Parse(Stream(csv));

        Assert.Contains(result.Errors, error => error.Contains("netWeightKg", StringComparison.Ordinal));
        Assert.Contains(result.Errors, error => error.Contains("duplicated", StringComparison.Ordinal));
        Assert.Single(result.Rows);
    }

    [Fact]
    public void Parse_rejects_an_empty_file()
    {
        var result = _parser.Parse(Stream("   \n"));
        Assert.Contains(result.Errors, error => error.Contains("empty", StringComparison.OrdinalIgnoreCase));
    }

    private static MemoryStream Stream(string csv) => new(Encoding.UTF8.GetBytes(csv));

    private static string TeaGradeName(string grade) => grade;
}
