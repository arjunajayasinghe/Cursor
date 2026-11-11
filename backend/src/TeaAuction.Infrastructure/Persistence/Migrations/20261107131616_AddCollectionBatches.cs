using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeaAuction.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCollectionBatches : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "seller_name",
                table: "purchased_invoice_lots",
                type: "character varying(160)",
                maxLength: 160,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "seller_vat_no",
                table: "purchased_invoice_lots",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "collection_batches",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    sale_id = table.Column<Guid>(type: "uuid", nullable: true),
                    sale_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    year = table.Column<int>(type: "integer", nullable: false),
                    centre = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    sale_date = table.Column<DateOnly>(type: "date", nullable: false),
                    name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    lot_count = table.Column<int>(type: "integer", nullable: false),
                    bag_count = table.Column<int>(type: "integer", nullable: false),
                    net_weight_kg = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_collection_batches", x => x.id);
                    table.ForeignKey(
                        name: "FK_collection_batches_sales_sale_id",
                        column: x => x.sale_id,
                        principalTable: "sales",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "collection_lots",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    collection_batch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    purchased_invoice_lot_id = table.Column<Guid>(type: "uuid", nullable: true),
                    purchased_invoice_id = table.Column<Guid>(type: "uuid", nullable: true),
                    catalogue_lot_id = table.Column<Guid>(type: "uuid", nullable: true),
                    broker = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    lot_number = table.Column<int>(type: "integer", nullable: false),
                    selling_mark = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    seller_name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    seller_vat_no = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    invoice_number = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    grade = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    bags = table.Column<int>(type: "integer", nullable: false),
                    net_per_bag_kg = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    net_weight_kg = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    sold_price_per_kg = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    proceeds = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    vat_amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    proceeds_with_vat = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    warehouse_or_basis = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    buyer_code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    buyer_name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    garden_mark = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    selected_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_collection_lots", x => x.id);
                    table.ForeignKey(
                        name: "FK_collection_lots_collection_batches_collection_batch_id",
                        column: x => x.collection_batch_id,
                        principalTable: "collection_batches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_collection_batches_sale_id",
                table: "collection_batches",
                column: "sale_id");

            migrationBuilder.CreateIndex(
                name: "IX_collection_batches_year_sale_number",
                table: "collection_batches",
                columns: new[] { "year", "sale_number" });

            migrationBuilder.CreateIndex(
                name: "IX_collection_lots_collection_batch_id_broker_lot_number",
                table: "collection_lots",
                columns: new[] { "collection_batch_id", "broker", "lot_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_collection_lots_purchased_invoice_lot_id",
                table: "collection_lots",
                column: "purchased_invoice_lot_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "collection_lots");

            migrationBuilder.DropTable(
                name: "collection_batches");

            migrationBuilder.DropColumn(
                name: "seller_name",
                table: "purchased_invoice_lots");

            migrationBuilder.DropColumn(
                name: "seller_vat_no",
                table: "purchased_invoice_lots");
        }
    }
}
