using Microsoft.AspNetCore.Mvc;
using TeaAuction.Application.Catalog;
using TeaAuction.Application.Dtos;

namespace TeaAuction.Api.Endpoints;

public static class CollectionEndpoints
{
    public static RouteGroupBuilder MapCollectionEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/collections", async (CollectionService service, CancellationToken cancellationToken) =>
                Results.Ok(await service.ListAsync(cancellationToken)))
            .WithName("ListCollectionBatches")
            .WithTags("Collections")
            .WithSummary("List collection batches (lots selected for sample/bag ops)")
            .Produces<IReadOnlyList<CollectionBatchSummaryDto>>();

        group.MapGet("/collections/{id:guid}", async (
                Guid id,
                CollectionService service,
                CancellationToken cancellationToken) =>
            {
                var detail = await service.GetAsync(id, cancellationToken);
                return detail is null ? Results.NotFound() : Results.Ok(detail);
            })
            .WithName("GetCollectionBatch")
            .WithTags("Collections")
            .Produces<CollectionBatchDetailDto>()
            .Produces(StatusCodes.Status404NotFound);

        group.MapPost("/collections/select", async (
                [FromBody] SelectCollectionLotsRequest body,
                CollectionService service,
                CancellationToken cancellationToken) =>
            {
                var result = await service.SelectLotsAsync(body, cancellationToken);
                if (!result.Succeeded)
                    return Results.BadRequest(new ErrorResponse(result.Errors));
                return Results.Ok(result.Value);
            })
            .WithName("SelectCollectionLots")
            .WithTags("Collections")
            .WithSummary("Copy selected PDF invoice lots into the sale collection batch (next stage)")
            .Produces<CollectionBatchDetailDto>()
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);

        return group;
    }
}
