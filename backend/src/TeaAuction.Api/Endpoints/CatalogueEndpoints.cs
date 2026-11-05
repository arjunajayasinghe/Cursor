using Microsoft.AspNetCore.Mvc;
using TeaAuction.Api.Contracts;
using TeaAuction.Application.Catalog;
using TeaAuction.Application.Dtos;

namespace TeaAuction.Api.Endpoints;

public static class CatalogueEndpoints
{
    public static RouteGroupBuilder MapCatalogueEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/sales", async (SaleQueryService sales, CancellationToken cancellationToken) =>
                Results.Ok(await sales.ListAsync(cancellationToken)))
            .WithName("ListSales")
            .WithTags("Sales")
            .WithSummary("List auction sales")
            .Produces<IReadOnlyList<SaleSummaryDto>>();

        group.MapGet("/sales/{id:guid}", async (Guid id, SaleQueryService sales, CancellationToken cancellationToken) =>
            {
                var sale = await sales.GetAsync(id, cancellationToken);
                return sale is null ? Results.NotFound() : Results.Ok(sale);
            })
            .WithName("GetSale")
            .WithTags("Sales")
            .WithSummary("Get one sale and its lots")
            .Produces<SaleDetailDto>()
            .Produces(StatusCodes.Status404NotFound);

        group.MapGet("/uploads", async (SaleQueryService sales, CancellationToken cancellationToken) =>
                Results.Ok(await sales.ListUploadsAsync(cancellationToken)))
            .WithName("ListUploads")
            .WithTags("Uploads")
            .WithSummary("List catalogue uploads")
            .Produces<IReadOnlyList<UploadBatchDto>>();

        group.MapPost("/uploads", CreateUpload)
            .WithName("CreateUpload")
            .WithTags("Uploads")
            .WithSummary("Upload a broker catalogue file")
            .Produces<UploadAcceptedDto>(StatusCodes.Status202Accepted)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .DisableAntiforgery();

        group.MapGet("/uploads/{id:guid}", async (Guid id, SaleQueryService sales, CancellationToken cancellationToken) =>
            {
                var upload = await sales.GetUploadAsync(id, cancellationToken);
                return upload is null ? Results.NotFound() : Results.Ok(upload);
            })
            .WithName("GetUpload")
            .WithTags("Uploads")
            .WithSummary("Get a pre-auction catalogue upload and its lots")
            .Produces<UploadDetailDto>()
            .Produces(StatusCodes.Status404NotFound);

        return group;
    }

    private static async Task<IResult> CreateUpload(
        [FromForm] UploadForm form,
        UploadService uploads,
        CancellationToken cancellationToken)
    {
        await using var stream = form.File?.OpenReadStream() ?? Stream.Null;
        var result = await uploads.CreateAsync(new CreateUploadCommand
        {
            SaleNumber = form.SaleNumber,
            Year = form.Year,
            Centre = form.Centre,
            SaleDate = form.SaleDate,
            Broker = form.Broker,
            Kind = string.IsNullOrWhiteSpace(form.Kind) ? "PreAuctionCatalogue" : form.Kind,
            FileName = form.File?.FileName ?? "",
            Length = form.File?.Length ?? 0
        }, stream, cancellationToken);

        if (!result.Succeeded || result.Value is null)
            return Results.BadRequest(new ErrorResponse(result.Errors));

        return Results.Accepted($"/api/uploads/{result.Value.Id}", result.Value);
    }
}
