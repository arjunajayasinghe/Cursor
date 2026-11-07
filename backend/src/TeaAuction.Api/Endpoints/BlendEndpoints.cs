using Microsoft.AspNetCore.Mvc;
using TeaAuction.Application.Catalog;
using TeaAuction.Application.Dtos;
using TeaAuction.Domain;

namespace TeaAuction.Api.Endpoints;

public static class BlendEndpoints
{
    public static RouteGroupBuilder MapBlendEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/blends", async (
                [FromQuery] string? status,
                BlendService service,
                CancellationToken cancellationToken) =>
            {
                BlendSheetStatus? parsed = null;
                if (!string.IsNullOrWhiteSpace(status)
                    && Enum.TryParse<BlendSheetStatus>(status, true, out var s))
                    parsed = s;
                return Results.Ok(await service.ListAsync(parsed, cancellationToken));
            })
            .WithName("ListBlendSheets")
            .WithTags("Blends");

        group.MapGet("/blends/inventory", async (
                [FromQuery] Guid? excludeBlendSheetId,
                [FromQuery] string? saleNumber,
                [FromQuery] string? broker,
                [FromQuery] string? grade,
                [FromQuery] string? estate,
                BlendService service,
                CancellationToken cancellationToken) =>
            {
                var rows = await service.ListInventoryAsync(
                    excludeBlendSheetId, saleNumber, broker, grade, estate, cancellationToken);
                return Results.Ok(rows);
            })
            .WithName("ListBlendInventory")
            .WithTags("Blends")
            .WithSummary("Collected sample lots available for blend allocation");

        group.MapGet("/blends/{id:guid}", async (
                Guid id,
                BlendService service,
                CancellationToken cancellationToken) =>
            {
                var detail = await service.GetAsync(id, cancellationToken);
                return detail is null ? Results.NotFound() : Results.Ok(detail);
            })
            .WithName("GetBlendSheet")
            .WithTags("Blends");

        group.MapPost("/blends", async (
                [FromBody] SaveBlendSheetRequest body,
                BlendService service,
                CancellationToken cancellationToken) =>
            {
                var result = await service.SaveDraftAsync(body, cancellationToken);
                if (!result.Succeeded)
                    return Results.BadRequest(new ErrorResponse(result.Errors));
                return Results.Ok(result.Value);
            })
            .WithName("SaveBlendSheet")
            .WithTags("Blends")
            .WithSummary("Create/update blend sheet with temp inventory allocations");

        group.MapPost("/blends/{id:guid}/confirm", async (
                Guid id,
                BlendService service,
                CancellationToken cancellationToken) =>
            {
                var result = await service.ConfirmAsync(new ConfirmBlendSheetRequest(id), cancellationToken);
                if (!result.Succeeded)
                    return Results.BadRequest(new ErrorResponse(result.Errors));
                return Results.Ok(result.Value);
            })
            .WithName("ConfirmBlendSheet")
            .WithTags("Blends")
            .WithSummary("Confirm blend: temp allocations become firm; allocated qty must equal estimated/target qty");

        return group;
    }
}
