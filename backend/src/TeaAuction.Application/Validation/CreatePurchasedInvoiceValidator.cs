using FluentValidation;
using TeaAuction.Application.Catalog;

namespace TeaAuction.Application.Validation;

public sealed class CreatePurchasedInvoiceValidator : AbstractValidator<CreatePurchasedInvoiceCommand>
{
    public CreatePurchasedInvoiceValidator()
    {
        RuleFor(x => x.SaleNumber).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Year).InclusiveBetween(2000, 2100);
        RuleFor(x => x.Centre).NotEmpty();
        RuleFor(x => x.Broker).NotEmpty();
        RuleFor(x => x.FileName).NotEmpty();
        RuleFor(x => x.Length).GreaterThan(0).LessThanOrEqualTo(10 * 1024 * 1024);
    }
}
