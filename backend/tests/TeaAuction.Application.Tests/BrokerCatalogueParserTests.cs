using System.Text;
using TeaAuction.Application.Catalog;
using TeaAuction.Domain;

namespace TeaAuction.Application.Tests;

public class BrokerCatalogueParserTests
{
    private readonly BrokerCatalogueParser _parser = new();

    [Fact]
    public void Parses_an_asia_siyaka_row_with_full_catalogue_fields()
    {
        const string line =
            "AS     3    21/01/2026 0001 MF0093  ANCOOMBRA                 1417    BOPF         20    B    55.00    1100.00   MWP    EX ESTATE                                 10";

        var result = _parser.Parse(BrokerCode.AS, Stream(line));

        Assert.Empty(result.Errors);
        var row = Assert.Single(result.Rows);
        Assert.Equal(1, row.LotNumber);
        Assert.Equal("MF0093", row.FactoryCode);
        Assert.Equal("ANCOOMBRA", row.GardenMark);
        Assert.Equal("1417", row.InvoiceNumber);
        Assert.Equal("BOPF", row.Grade);
        Assert.Equal(20, row.Bags);
        Assert.Equal("B", row.PackageType);
        Assert.Equal(55.00m, row.NetPerBagKg);
        Assert.Equal(1100.00m, row.NetWeightKg);
        Assert.Equal("MWP", row.SellingMark);
        Assert.Equal("EX ESTATE", row.WarehouseOrBasis);
        Assert.Equal(line, row.SourceLine);
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
        Assert.Equal("MF0007", row.FactoryCode);
        Assert.Equal("WINDSORFOREST", row.GardenMark);
        Assert.Equal("BOPSp", row.Grade);
        Assert.Equal(42.00m, row.NetPerBagKg);
        Assert.Equal(420.00m, row.NetWeightKg);
        Assert.Equal("EX-ESTATE", row.WarehouseOrBasis);
    }

    [Fact]
    public void Parses_a_mercantile_row_with_category_and_mark()
    {
        const string line =
            "00003   000001  EX  MF 01257  UPLANDS                       0000816 BOPF     BAGS SPBS 00020055000000000000000000000000110000                                               260121";

        var result = _parser.Parse(BrokerCode.MB, Stream(line));

        Assert.Empty(result.Errors);
        var row = Assert.Single(result.Rows);
        Assert.Equal(1, row.LotNumber);
        Assert.Equal("MF01257", row.FactoryCode);
        Assert.Equal("UPLANDS", row.GardenMark);
        Assert.Equal("816", row.InvoiceNumber);
        Assert.Equal("BOPF", row.Grade);
        Assert.Equal("BAGS", row.PackageType);
        Assert.Equal("SPBS", row.SellingMark);
        Assert.Equal("EX", row.Category);
        Assert.Equal(20, row.Bags);
        Assert.Equal(55.00m, row.NetPerBagKg);
        Assert.Equal(1100.00m, row.NetWeightKg);
    }

    [Fact]
    public void Parses_bc_rows_when_grade_is_glued_to_the_warehouse_address()
    {
        const string line =
            "003  10MF1590 UVA SAMOVAR                             MF151SPBS                FW 105/4, MUTHURAJAWELA ROAD, MUTHURAJAWELAOP1          10.00B   26.00      260.002026 0925    BC0052     0.00";

        var result = _parser.Parse(BrokerCode.BC, Stream(line));

        Assert.Empty(result.Errors);
        var row = Assert.Single(result.Rows);
        Assert.Equal(52, row.LotNumber);
        Assert.Equal("OP1", row.Grade);
        Assert.Equal(10, row.Bags);
        Assert.Equal(26.00m, row.NetPerBagKg);
        Assert.Equal(260.00m, row.NetWeightKg);
        Assert.Equal("0925", row.InvoiceNumber);
    }

    [Fact]
    public void Parses_eb_mark_lot_and_invoice_total_from_dense_rows()
    {
        const string line =
            "MF0034   STRATHSPEY                20B50.00 4BOP                                  MWP   1  0421R1000.00";

        var result = _parser.Parse(BrokerCode.EB, Stream(line));

        Assert.Empty(result.Errors);
        var row = Assert.Single(result.Rows);
        Assert.Equal(1, row.LotNumber);
        Assert.Equal("STRATHSPEY", row.GardenMark);
        Assert.Equal("BOP", row.Grade);
        Assert.Equal(20, row.Bags);
        Assert.Equal(50.00m, row.NetPerBagKg);
        Assert.Equal(1000.00m, row.NetWeightKg);
        Assert.Equal("0421", row.InvoiceNumber);
        Assert.Equal("MWP", row.SellingMark);
    }

    [Fact]
    public void Parses_jk_hessian_package_rows()
    {
        const string line =
            "01234MF 1407 BOGODA GROUP             0652 023FBOPFSp          .0090JOHN KEELLS WAREHOUSING E40MR.AVANTHA RATNAYAKE                         L H-SPBS  0    80.00   4 20.00H   0   .00    0   .00    0   .00       0 3 Premium Flowery              7 21-01-2026";

        var result = _parser.Parse(BrokerCode.JK, Stream(line));

        Assert.Empty(result.Errors);
        var row = Assert.Single(result.Rows);
        Assert.Equal(1234, row.LotNumber);
        Assert.Equal("BOGODA GROUP", row.GardenMark);
        Assert.Equal(4, row.Bags);
        Assert.Equal("H", row.PackageType);
        Assert.Equal(20.00m, row.NetPerBagKg);
        Assert.Equal(80.00m, row.NetWeightKg);
    }

    private static MemoryStream Stream(string text) => new(Encoding.Latin1.GetBytes(text));
}
