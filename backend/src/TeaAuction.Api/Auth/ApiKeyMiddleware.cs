using System.Security.Cryptography;
using System.Text;
using TeaAuction.Application.Dtos;

namespace TeaAuction.Api.Auth;

public sealed class ApiKeyMiddleware(RequestDelegate next, IConfiguration configuration, IHostEnvironment environment)
{
    public const string HeaderName = "X-Api-Key";

    public async Task InvokeAsync(HttpContext context)
    {
        if (HttpMethods.IsOptions(context.Request.Method) || IsPublic(context.Request.Path))
        {
            await next(context);
            return;
        }

        var configured = configuration["Auth:ApiKey"];
        if (string.IsNullOrWhiteSpace(configured))
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsJsonAsync(new ErrorResponse(["API key authentication is not configured."]));
            return;
        }

        var provided = context.Request.Headers[HeaderName].ToString();
        if (!Matches(provided, configured))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new ErrorResponse(["A valid X-Api-Key header is required."]));
            return;
        }

        await next(context);
    }

    private bool IsPublic(PathString path)
    {
        if (path.StartsWithSegments("/health")
            || path.StartsWithSegments("/swagger")
            || path.StartsWithSegments("/openapi"))
            return true;

        return environment.IsDevelopment() && path.StartsWithSegments("/hangfire");
    }

    private static bool Matches(string provided, string configured)
    {
        var providedBytes = Encoding.UTF8.GetBytes(provided);
        var configuredBytes = Encoding.UTF8.GetBytes(configured);
        return providedBytes.Length == configuredBytes.Length
            && CryptographicOperations.FixedTimeEquals(providedBytes, configuredBytes);
    }
}
