using System.Text;
using TeaAuction.Application.Catalog;
using TeaAuction.Domain;

namespace TeaAuction.Application.Tests;

public class BrokerCatalogueParserTests
{
    private readonly BrokerCatalogueParser _parser = new();

    [Fact]
    public void Parses_an_asia_siyaka_row()
    {
        const string line =
            "AS     3    21/01/2026 0001 MF0093  ANCOOMBRA                 1417    BOPF         20    B    55.00    1100.00   MWP    EX ESTATE                                 10";

        var result = _parser.Parse(BrokerCode.AS, Stream(line));

        Assert.Empty(result.Errors);
        var row = Assert.Single(result.Rows);
        Assert.Equal(1, row.LotNumber);
        Assert.Equal("ANCOOMBRA", row.GardenMark);
        Assert.Equal("1417", row.InvoiceNumber);
        Assert.Equal("BOPF", row.Grade);
        Assert.Equal(20, row.Bags);
        Assert.Equal(1100.00m, row.NetWeightKg);
    }

    [Fact]
    public void Parses_a_forbes_walker_row_and_skips_noise()
    {
        const string text = """
            FW    3  21/01/26    1         MF0007   WINDSORFOREST                   311      BOPSp          10  B      42.00     420.00       1  EX-ESTATE                                 10

                                                                                                  2         56.50
            """;

        var result = _parser.Parse(BrokerCode.FW, Stream(text));

        Assert.Empty(result.Errors);
        var row = Assert.Single(result.Rows);
        Assert.Equal(1, row.LotNumber);
        Assert.Equal("WINDSORFOREST", row.GardenMark);
        Assert.Equal("BOPSp", row.Grade);
        Assert.Equal(420.00m, row.NetWeightKg);
    }

    private static MemoryStream Stream(string text) => new(Encoding.Latin1.GetBytes(text));
}
