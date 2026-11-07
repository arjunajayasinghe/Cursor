using Microsoft.AspNetCore.Mvc;
using TeaAuction.Api.Contracts;
using TeaAuction.Application.Catalog;
using TeaAuction.Application.Dtos;

namespace TeaAuction.Api.Endpoints;

public static class PurchasedInvoiceEndpoints
{
    public static RouteGroupBuilder MapPurchasedInvoiceEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/purchased-invoices", async (PurchasedInvoiceService service, CancellationToken cancellationToken) =>
                Results.Ok(await service.ListAsync(cancellationToken)))
            .WithName("ListPurchasedInvoices")
            .WithTags("PurchasedInvoices")
            .WithSummary("List uploaded buyer purchase invoice PDFs")
            .Produces<IReadOnlyList<PurchasedInvoiceSummaryDto>>();

        group.MapGet("/purchased-invoices/workbench", async (
                [FromQuery] string? saleNumber,
                [FromQuery] int? year,
                PurchasedInvoiceService service,
                CancellationToken cancellationToken) =>
            {
                var board = await service.GetWorkbenchAsync(saleNumber, year, cancellationToken);
                return board is null ? Results.Ok(null) : Results.Ok(board);
            })
            .WithName("GetPurchasedInvoiceWorkbench")
            .WithTags("PurchasedInvoices")
            .WithSummary("Combined purchase workbench for one sale (all broker invoices together)")
            .Produces<PurchasedInvoiceWorkbenchDto>();

        group.MapGet("/purchased-invoices/{id:guid}", async (
                Guid id,
                PurchasedInvoiceService service,
                CancellationToken cancellationToken) =>
            {
                var detail = await service.GetAsync(id, cancellationToken);
                return detail is null ? Results.NotFound() : Results.Ok(detail);
            })
            .WithName("GetPurchasedInvoice")
            .WithTags("PurchasedInvoices")
            .Produces<PurchasedInvoiceDetailDto>()
            .Produces(StatusCodes.Status404NotFound);

        group.MapGet("/purchased-invoices/{id:guid}/pdf", async (
                Guid id,
                PurchasedInvoiceService service,
                CancellationToken cancellationToken) =>
            {
                var file = await service.OpenPdfAsync(id, cancellationToken);
                if (file is null) return Results.NotFound();
                return Results.File(file.Value.Content, file.Value.ContentType, file.Value.FileName);
            })
            .WithName("GetPurchasedInvoicePdf")
            .WithTags("PurchasedInvoices")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        group.MapPost("/purchased-invoices", Create)
            .WithName("CreatePurchasedInvoice")
            .WithTags("PurchasedInvoices")
            .WithSummary("Upload one broker purchased-invoice PDF (buyer account)")
            .Produces<UploadAcceptedDto>(StatusCodes.Status202Accepted)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .DisableAntiforgery();

        return group;
    }

    private static async Task<IResult> Create(
        [FromForm] PurchasedInvoiceForm form,
        PurchasedInvoiceService service,
        CancellationToken cancellationToken)
    {
        await using var stream = form.File?.OpenReadStream() ?? Stream.Null;
        var result = await service.CreateAsync(new CreatePurchasedInvoiceCommand(
            form.SaleNumber,
            form.Year,
            form.Centre,
            form.SaleDate,
            form.Broker,
            form.File?.FileName ?? "",
            form.File?.Length ?? 0), stream, cancellationToken);

        if (!result.Succeeded || result.Value is null)
            return Results.BadRequest(new ErrorResponse(result.Errors));

        return Results.Accepted($"/api/purchased-invoices/{result.Value.Id}", result.Value);
    }
}

public sealed class PurchasedInvoiceForm
{
    public string SaleNumber { get; set; } = "";
    public int Year { get; set; }
    public string Centre { get; set; } = "";
    public DateOnly SaleDate { get; set; }
    public string Broker { get; set; } = "";
    public IFormFile? File { get; set; }
}
