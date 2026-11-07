using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeaAuction.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCatalogue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "sales",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    sale_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    year = table.Column<int>(type: "integer", nullable: false),
                    centre = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    sale_date = table.Column<DateOnly>(type: "date", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sales", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "upload_batches",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    sale_id = table.Column<Guid>(type: "uuid", nullable: true),
                    sale_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    year = table.Column<int>(type: "integer", nullable: false),
                    centre = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    sale_date = table.Column<DateOnly>(type: "date", nullable: false),
                    original_file_name = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    storage_key = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    content_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    lot_count = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    processed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_upload_batches", x => x.id);
                    table.ForeignKey(
                        name: "FK_upload_batches_sales_sale_id",
                        column: x => x.sale_id,
                        principalTable: "sales",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "lots",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    sale_id = table.Column<Guid>(type: "uuid", nullable: false),
                    upload_batch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    lot_number = table.Column<int>(type: "integer", nullable: false),
                    garden_mark = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    invoice_number = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    grade = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    bags = table.Column<int>(type: "integer", nullable: false),
                    net_weight_kg = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    valuation_per_kg = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lots", x => x.id);
                    table.ForeignKey(
                        name: "FK_lots_sales_sale_id",
                        column: x => x.sale_id,
                        principalTable: "sales",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_lots_upload_batches_upload_batch_id",
                        column: x => x.upload_batch_id,
                        principalTable: "upload_batches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lots_sale_id_lot_number",
                table: "lots",
                columns: new[] { "sale_id", "lot_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lots_upload_batch_id",
                table: "lots",
                column: "upload_batch_id");

            migrationBuilder.CreateIndex(
                name: "IX_sales_centre_year_sale_number",
                table: "sales",
                columns: new[] { "centre", "year", "sale_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_upload_batches_sale_id",
                table: "upload_batches",
                column: "sale_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "lots");

            migrationBuilder.DropTable(
                name: "upload_batches");

            migrationBuilder.DropTable(
                name: "sales");
        }
    }
}
