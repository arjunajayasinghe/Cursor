using FluentValidation;
using TeaAuction.Application.Catalog;

namespace TeaAuction.Application.Validation;

public sealed class LotCsvRowValidator : AbstractValidator<LotCsvRow>
{
    public LotCsvRowValidator()
    {
        RuleFor(row => row.LotNumber)
            .GreaterThan(0)
            .WithMessage("Lot number must be greater than zero.");

        RuleFor(row => row.GardenMark)
            .NotEmpty()
            .MaximumLength(80)
            .WithMessage("Garden mark is required and must be 80 characters or fewer.");

        RuleFor(row => row.InvoiceNumber)
            .NotEmpty()
            .MaximumLength(40)
            .WithMessage("Invoice number is required and must be 40 characters or fewer.");

        RuleFor(row => row.Grade)
            .NotEmpty()
            .MaximumLength(32)
            .WithMessage("Grade is required and must be 32 characters or fewer.");

        RuleFor(row => row.Bags)
            .InclusiveBetween(1, 10_000);

        RuleFor(row => row.NetWeightKg)
            .GreaterThan(0)
            .LessThanOrEqualTo(100_000);

        RuleFor(row => row.ValuationPerKg)
            .GreaterThanOrEqualTo(0)
            .When(row => row.ValuationPerKg.HasValue);
    }
}
