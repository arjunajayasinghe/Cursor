using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeaAuction.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EnforceUniqueCollectedInvoiceLots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_collection_lots_purchased_invoice_lot_id",
                table: "collection_lots");

            migrationBuilder.CreateIndex(
                name: "IX_collection_lots_purchased_invoice_lot_id",
                table: "collection_lots",
                column: "purchased_invoice_lot_id",
                unique: true,
                filter: "purchased_invoice_lot_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_collection_lots_purchased_invoice_lot_id",
                table: "collection_lots");

            migrationBuilder.CreateIndex(
                name: "IX_collection_lots_purchased_invoice_lot_id",
                table: "collection_lots",
                column: "purchased_invoice_lot_id");
        }
    }
}
