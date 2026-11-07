using Microsoft.AspNetCore.Mvc;
using TeaAuction.Application.Catalog;
using TeaAuction.Application.Dtos;

namespace TeaAuction.Api.Endpoints;

public static class SampleBoxEndpoints
{
    public static RouteGroupBuilder MapSampleBoxEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/collections/{batchId:guid}/boxes", async (
                Guid batchId,
                SampleBoxService service,
                CancellationToken cancellationToken) =>
            {
                var ready = await service.ReadyForBlendingAsync(batchId, cancellationToken);
                var boxes = await service.ListByBatchAsync(batchId, cancellationToken);
                return Results.Ok(new { readyForBlending = ready, boxes });
            })
            .WithName("ListSampleBoxes")
            .WithTags("SampleBoxes")
            .WithSummary("List sample collection boxes for a collection batch");

        group.MapGet("/collections/boxes/{id:guid}", async (
                Guid id,
                SampleBoxService service,
                CancellationToken cancellationToken) =>
            {
                var detail = await service.GetAsync(id, cancellationToken);
                return detail is null ? Results.NotFound() : Results.Ok(detail);
            })
            .WithName("GetSampleBox")
            .WithTags("SampleBoxes")
            .Produces<SampleBoxDetailDto>()
            .Produces(StatusCodes.Status404NotFound);

        group.MapPost("/collections/boxes/generate", async (
                [FromBody] GenerateSampleBoxesRequest body,
                SampleBoxService service,
                CancellationToken cancellationToken) =>
            {
                var result = await service.GenerateAsync(body, cancellationToken);
                if (!result.Succeeded)
                    return Results.BadRequest(new ErrorResponse(result.Errors));
                return Results.Ok(result.Value);
            })
            .WithName("GenerateSampleBoxes")
            .WithTags("SampleBoxes")
            .WithSummary("Generate sequential BOX-YYYY-###### numbers for selected collection lots")
            .Produces<IReadOnlyList<SampleBoxDetailDto>>()
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);

        group.MapPost("/collections/boxes/{id:guid}/print", async (
                Guid id,
                SampleBoxService service,
                CancellationToken cancellationToken) =>
            {
                var result = await service.RecordPrintAsync(id, cancellationToken);
                if (!result.Succeeded)
                    return Results.BadRequest(new ErrorResponse(result.Errors));
                return Results.Ok(result.Value);
            })
            .WithName("RecordSampleBoxPrint")
            .WithTags("SampleBoxes")
            .WithSummary("Record a print/reprint of a sample box label (audit trail)")
            .Produces<SampleBoxDetailDto>()
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);

        group.MapPost("/collections/boxes/received", async (
                [FromBody] MarkSampleBoxesReceivedRequest body,
                SampleBoxService service,
                CancellationToken cancellationToken) =>
            {
                var result = await service.MarkReceivedAsync(body, cancellationToken);
                if (!result.Succeeded)
                    return Results.BadRequest(new ErrorResponse(result.Errors));
                return Results.Ok(result.Value);
            })
            .WithName("MarkSampleBoxesReceived")
            .WithTags("SampleBoxes")
            .WithSummary("Mark sample boxes as collected/received — same step after box numbers are generated")
            .Produces<IReadOnlyList<SampleBoxSummaryDto>>()
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);

        group.MapPost("/collections/boxes/reverse", async (
                [FromBody] ReverseSampleBoxesRequest body,
                SampleBoxService service,
                CancellationToken cancellationToken) =>
            {
                var result = await service.ReverseAsync(body, cancellationToken);
                if (!result.Succeeded)
                    return Results.BadRequest(new ErrorResponse(result.Errors));
                return Results.Ok(result.Value);
            })
            .WithName("ReverseSampleBoxes")
            .WithTags("SampleBoxes")
            .WithSummary("Reverse box generation (Open/Printed only) — unlinks lots so numbers can be regenerated")
            .Produces<IReadOnlyList<SampleBoxSummaryDto>>()
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);

        return group;
    }
}
