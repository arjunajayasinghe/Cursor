using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace TeaAuction.Api.OpenApi;

public sealed class ApiKeyDocumentTransformer : IOpenApiDocumentTransformer
{
    public Task TransformAsync(OpenApiDocument document, OpenApiDocumentTransformerContext context, CancellationToken cancellationToken)
    {
        document.Info ??= new OpenApiInfo();
        document.Info.Title = "Tea Auction Upload API";
        document.Info.Version = "v1";
        document.Info.Description =
            "Upload tea auction sale catalogues and list the sales and lots that were accepted.";

        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes[Auth.ApiKeyMiddleware.HeaderName] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.ApiKey,
            Name = Auth.ApiKeyMiddleware.HeaderName,
            In = ParameterLocation.Header,
            Description = "Development API key. Send the configured key in the X-Api-Key header."
        };

        document.Security ??= [];
        document.Security.Add(new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference(Auth.ApiKeyMiddleware.HeaderName, document)] = []
        });

        return Task.CompletedTask;
    }
}
