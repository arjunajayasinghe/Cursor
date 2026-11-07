using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeaAuction.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchasedInvoices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "purchased_invoices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    sale_id = table.Column<Guid>(type: "uuid", nullable: true),
                    sale_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    year = table.Column<int>(type: "integer", nullable: false),
                    centre = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    sale_date = table.Column<DateOnly>(type: "date", nullable: false),
                    broker = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    buyer_code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    buyer_name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    contract_no = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    original_file_name = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    storage_key = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    content_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    lot_count = table.Column<int>(type: "integer", nullable: false),
                    net_weight_kg = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    proceeds = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    vat_amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    payable = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    processed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_purchased_invoices", x => x.id);
                    table.ForeignKey(
                        name: "FK_purchased_invoices_sales_sale_id",
                        column: x => x.sale_id,
                        principalTable: "sales",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "purchased_invoice_lots",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    purchased_invoice_id = table.Column<Guid>(type: "uuid", nullable: false),
                    broker = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    lot_number = table.Column<int>(type: "integer", nullable: false),
                    selling_mark = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    invoice_number = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    grade = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    bags = table.Column<int>(type: "integer", nullable: false),
                    net_per_bag_kg = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    net_weight_kg = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    sold_price_per_kg = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    proceeds = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    vat_amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    proceeds_with_vat = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_purchased_invoice_lots", x => x.id);
                    table.ForeignKey(
                        name: "FK_purchased_invoice_lots_purchased_invoices_purchased_invoice~",
                        column: x => x.purchased_invoice_id,
                        principalTable: "purchased_invoices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_purchased_invoice_lots_purchased_invoice_id_lot_number",
                table: "purchased_invoice_lots",
                columns: new[] { "purchased_invoice_id", "lot_number" });

            migrationBuilder.CreateIndex(
                name: "IX_purchased_invoices_sale_id",
                table: "purchased_invoices",
                column: "sale_id");

            migrationBuilder.CreateIndex(
                name: "IX_purchased_invoices_year_sale_number_broker",
                table: "purchased_invoices",
                columns: new[] { "year", "sale_number", "broker" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "purchased_invoice_lots");

            migrationBuilder.DropTable(
                name: "purchased_invoices");
        }
    }
}
