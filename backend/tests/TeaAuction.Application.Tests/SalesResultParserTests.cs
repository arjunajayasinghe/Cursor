using System.Text;
using TeaAuction.Application.Catalog;
using TeaAuction.Domain;

namespace TeaAuction.Application.Tests;

public class SalesResultParserTests
{
    private readonly SalesResultParser _parser = new();

    [Fact]
    public void Parses_sales_csv_by_header_names()
    {
        const string csv = """
            Lot No,Garden,Sold Price,Buyer
            1,ANCOOMBRA,1250.00,ABC
            2,ROBGILL,980.50,XYZ
            """;

        var result = _parser.Parse(BrokerCode.AS, "ASC.csv", Stream(csv));

        Assert.Empty(result.Errors);
        Assert.Equal(2, result.Rows.Count);
        Assert.Equal(1, result.Rows[0].LotNumber);
        Assert.Equal(1250.00m, result.Rows[0].SoldPricePerKg);
        Assert.Equal("ABC", result.Rows[0].BuyerCode);
        Assert.Equal(2, result.Rows[1].LotNumber);
        Assert.Equal("XYZ", result.Rows[1].BuyerCode);
    }

    [Fact]
    public void Keeps_last_price_when_same_lot_appears_twice()
    {
        const string csv = """
            Lot,Price,Buyer
            10,100.00,AA
            10,250.00,BB
            """;

        var result = _parser.Parse(BrokerCode.AS, "sales.csv", Stream(csv));

        Assert.Empty(result.Errors);
        Assert.Single(result.Rows);
        Assert.Equal(10, result.Rows[0].LotNumber);
        Assert.Equal(250.00m, result.Rows[0].SoldPricePerKg);
        Assert.Equal("BB", result.Rows[0].BuyerCode);
    }

    [Fact]
    public void Parses_asc_sales_text_lot_price_buyer()
    {
        const string line =
            "081  28012026  4     1 0486R  MF0294   ROBGILL                       BOP             500.00    1400.00 10  SL18  SLS WAREHOUSING (PVT) LTD.    ";

        var result = _parser.Parse(BrokerCode.AS, "ASC.txt", Stream(line + "\n"));

        Assert.Empty(result.Errors);
        Assert.Single(result.Rows);
        Assert.Equal(1, result.Rows[0].LotNumber);
        Assert.Equal(1400.00m, result.Rows[0].SoldPricePerKg);
        Assert.Equal("SL18", result.Rows[0].BuyerCode);
        Assert.Equal(new DateOnly(2026, 1, 28), result.SaleDate);
        Assert.Equal("04", result.SaleNumber);
    }

    [Fact]
    public void Detects_sale_date_from_fw_priced_catalogue_header()
    {
        const string text = """

               FORBES & WALKER TEA BROKERS (PVT) LTD.                                                             PRICED CATALOGUE OF  03-02-2026
            MF0670   GARTMORE                        327      BOPF           10  B      58.00     580.00       1  EX-ESTATE                                 10   1160  VE1
            """;

        var result = _parser.Parse(BrokerCode.FW, "FW.TXT", Stream(text));

        Assert.Equal(new DateOnly(2026, 2, 3), result.SaleDate);
    }

    [Fact]
    public void Detects_sale_05_date_from_asc_file()
    {
        const string line =
            "081  03022026  5     1  0084  MF0062   KELANEIYA & BRAEMAR           BOPF            560.00    1100.00 10  HT01  HERITAGE TEAS (PVT) LTD.     ";

        var result = _parser.Parse(BrokerCode.AS, "ASC.txt", Stream(line + "\n"));

        Assert.Equal(new DateOnly(2026, 2, 3), result.SaleDate);
        Assert.Equal("05", result.SaleNumber);
    }

    [Fact]
    public void Parses_headerless_excel_style_csv_rows()
    {
        // Mimic LCB/EB sheet shape via CSV without headers: lot, grade, garden, blank, buyer, net, price
        const string csv = """
            1,BOPF,UPLANDS,,VANREES CEYLON LTD,1100,900
            2,BOPF,UPLANDS,,UNSOLD,1100,0
            """;

        var result = _parser.Parse(BrokerCode.LC, "LCB.csv", Stream(csv));

        // Without a header row the CSV reader still builds a table; headerless detection should kick in.
        Assert.True(result.Rows.Count >= 1, string.Join(" ", result.Errors));
        Assert.Equal(1, result.Rows[0].LotNumber);
        Assert.Equal(900m, result.Rows[0].SoldPricePerKg);
    }

    private static MemoryStream Stream(string text) => new(Encoding.UTF8.GetBytes(text));
}
