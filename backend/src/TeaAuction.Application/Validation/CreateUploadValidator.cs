using FluentValidation;
using TeaAuction.Application.Abstractions;
using TeaAuction.Application.Catalog;
using TeaAuction.Domain;

namespace TeaAuction.Application.Validation;

public sealed class CreateUploadValidator : AbstractValidator<CreateUploadCommand>
{
    public CreateUploadValidator()
    {
        RuleFor(command => command.SaleNumber)
            .NotEmpty()
            .MaximumLength(20)
            .Matches("^[A-Za-z0-9][A-Za-z0-9\\-/]*$")
            .WithMessage("Sale number may contain letters, numbers, hyphens, and slashes.");

        RuleFor(command => command.Year)
            .InclusiveBetween(1980, 2100);

        RuleFor(command => command.Centre)
            .NotEmpty()
            .Must(centre => Enum.TryParse<AuctionCentre>(centre, ignoreCase: true, out _))
            .WithMessage($"Centre must be one of: {string.Join(", ", Enum.GetNames<AuctionCentre>())}.");

        RuleFor(command => command.SaleDate)
            .Must(date => date != default)
            .WithMessage("Sale date is required.");

        RuleFor(command => command.Broker)
            .NotEmpty()
            .Must(broker => Enum.TryParse<BrokerCode>(broker, ignoreCase: true, out _))
            .WithMessage($"Broker must be one of: {string.Join(", ", Enum.GetNames<BrokerCode>())}.");

        RuleFor(command => command.Kind)
            .Must(kind => string.IsNullOrWhiteSpace(kind) || Enum.TryParse<UploadKind>(kind, ignoreCase: true, out _))
            .WithMessage($"Kind must be one of: {string.Join(", ", Enum.GetNames<UploadKind>())}.");

        RuleFor(command => command.FileName)
            .NotEmpty()
            .MaximumLength(260)
            .Must((command, name) =>
            {
                var kind = Enum.TryParse<UploadKind>(command.Kind, ignoreCase: true, out var parsed)
                    ? parsed
                    : UploadKind.PreAuctionCatalogue;
                return kind == UploadKind.PostAuctionSales
                    ? CatalogueFileKinds.IsSalesFile(name)
                    : CatalogueFileKinds.IsCsv(name) || CatalogueFileKinds.IsBrokerText(name);
            })
            .WithMessage("Upload a broker .txt/.csv catalogue, or for sales results a .txt/.csv/.xls/.xlsx file.");

        RuleFor(command => command.Length)
            .GreaterThan(0).WithMessage("The file is empty.")
            .LessThanOrEqualTo(10 * 1024 * 1024).WithMessage("The file must be 10 MB or smaller.");
    }
}
