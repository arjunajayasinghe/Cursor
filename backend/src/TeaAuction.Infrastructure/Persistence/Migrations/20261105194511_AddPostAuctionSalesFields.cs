using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeaAuction.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPostAuctionSalesFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "kind",
                table: "upload_batches",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "buyer_code",
                table: "lots",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "sales_upload_batch_id",
                table: "lots",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "sold_price_per_kg",
                table: "lots",
                type: "numeric(14,2)",
                precision: 14,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_upload_batches_kind",
                table: "upload_batches",
                column: "kind");

            migrationBuilder.CreateIndex(
                name: "IX_lots_sales_upload_batch_id",
                table: "lots",
                column: "sales_upload_batch_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_upload_batches_kind",
                table: "upload_batches");

            migrationBuilder.DropIndex(
                name: "IX_lots_sales_upload_batch_id",
                table: "lots");

            migrationBuilder.DropColumn(
                name: "kind",
                table: "upload_batches");

            migrationBuilder.DropColumn(
                name: "buyer_code",
                table: "lots");

            migrationBuilder.DropColumn(
                name: "sales_upload_batch_id",
                table: "lots");

            migrationBuilder.DropColumn(
                name: "sold_price_per_kg",
                table: "lots");
        }
    }
}
