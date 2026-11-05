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

    private static MemoryStream Stream(string text) => new(Encoding.UTF8.GetBytes(text));
}
