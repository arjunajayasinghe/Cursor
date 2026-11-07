using FluentValidation.TestHelper;
using TeaAuction.Application.Catalog;
using TeaAuction.Application.Validation;

namespace TeaAuction.Application.Tests;

public class CreateUploadValidatorTests
{
    private readonly CreateUploadValidator _validator = new();

    [Fact]
    public void Valid_command_has_no_errors()
    {
        var result = _validator.TestValidate(Sample());
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Accepts_a_broker_text_file()
    {
        var result = _validator.TestValidate(Sample() with { FileName = "AS - SC 03.txt" });
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Rejects_an_unknown_centre_and_a_non_catalogue()
    {
        var command = Sample() with { Centre = "London", Broker = "ZZ", FileName = "lots.xlsx", Year = 1800, Length = 0 };
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(command => command.Centre);
        result.ShouldHaveValidationErrorFor(command => command.Broker);
        result.ShouldHaveValidationErrorFor(command => command.FileName);
        result.ShouldHaveValidationErrorFor(command => command.Year);
        result.ShouldHaveValidationErrorFor(command => command.Length);
    }

    private static CreateUploadCommand Sample() => new()
    {
        SaleNumber = "23",
        Year = 2026,
        Centre = "Colombo",
        SaleDate = new DateOnly(2026, 5, 5),
        Broker = "AS",
        FileName = "lots.csv",
        Length = 128
    };
}
