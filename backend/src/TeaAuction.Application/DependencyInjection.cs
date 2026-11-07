using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using TeaAuction.Application.Abstractions;
using TeaAuction.Application.Catalog;
using TeaAuction.Application.Validation;

namespace TeaAuction.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssemblyContaining<CreateUploadValidator>();
        services.AddSingleton<ILotCsvParser, LotCsvParser>();
        services.AddSingleton<IBrokerCatalogueParser, BrokerCatalogueParser>();
        services.AddSingleton<ISalesResultParser, SalesResultParser>();
        services.AddSingleton<IPurchasedInvoicePdfParser, PurchasedInvoicePdfParser>();
        services.AddScoped<SaleQueryService>();
        services.AddScoped<UploadService>();
        services.AddScoped<UploadProcessingService>();
        services.AddScoped<PurchasedInvoiceService>();
        services.AddScoped<CollectionService>();
        return services;
    }
}
