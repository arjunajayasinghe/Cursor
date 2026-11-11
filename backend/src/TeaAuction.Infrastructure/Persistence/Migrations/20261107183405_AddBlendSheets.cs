using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeaAuction.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBlendSheets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "blend_sheets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    blend_number = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    blend_date = table.Column<DateOnly>(type: "date", nullable: false),
                    sales_order_ref = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    customer_name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    product_name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    target_quantity_kg = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    target_price_per_kg = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    target_tea_cost_per_kg = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    prepared_by = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    remarks = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    allocated_quantity_kg = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    total_raw_tea_cost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    weighted_average_cost_per_kg = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    version = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    confirmed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_blend_sheets", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "blend_sheet_lines",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    blend_sheet_id = table.Column<Guid>(type: "uuid", nullable: false),
                    collection_lot_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sample_box_id = table.Column<Guid>(type: "uuid", nullable: true),
                    sale_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    year = table.Column<int>(type: "integer", nullable: false),
                    broker = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    lot_number = table.Column<int>(type: "integer", nullable: false),
                    estate = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    grade = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    warehouse_or_basis = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    purchased_qty_kg = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    physical_stock_kg = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    allocated_qty_kg = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    unit_cost_per_kg = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    quality_status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_blend_sheet_lines", x => x.id);
                    table.ForeignKey(
                        name: "FK_blend_sheet_lines_blend_sheets_blend_sheet_id",
                        column: x => x.blend_sheet_id,
                        principalTable: "blend_sheets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_blend_sheet_lines_collection_lots_collection_lot_id",
                        column: x => x.collection_lot_id,
                        principalTable: "collection_lots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "inventory_reservations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    blend_sheet_id = table.Column<Guid>(type: "uuid", nullable: false),
                    blend_version = table.Column<int>(type: "integer", nullable: false),
                    collection_lot_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sap_item_code = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    sap_batch_number = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    warehouse_or_basis = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    reserved_quantity_kg = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    consumed_quantity_kg = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    released_quantity_kg = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_by = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_by = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_reservations", x => x.id);
                    table.ForeignKey(
                        name: "FK_inventory_reservations_blend_sheets_blend_sheet_id",
                        column: x => x.blend_sheet_id,
                        principalTable: "blend_sheets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_inventory_reservations_collection_lots_collection_lot_id",
                        column: x => x.collection_lot_id,
                        principalTable: "collection_lots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_blend_sheet_lines_blend_sheet_id_collection_lot_id",
                table: "blend_sheet_lines",
                columns: new[] { "blend_sheet_id", "collection_lot_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_blend_sheet_lines_collection_lot_id",
                table: "blend_sheet_lines",
                column: "collection_lot_id");

            migrationBuilder.CreateIndex(
                name: "IX_blend_sheets_blend_number",
                table: "blend_sheets",
                column: "blend_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_blend_sheets_status",
                table: "blend_sheets",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_reservations_blend_sheet_id",
                table: "inventory_reservations",
                column: "blend_sheet_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_reservations_collection_lot_id_status",
                table: "inventory_reservations",
                columns: new[] { "collection_lot_id", "status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "blend_sheet_lines");

            migrationBuilder.DropTable(
                name: "inventory_reservations");

            migrationBuilder.DropTable(
                name: "blend_sheets");
        }
    }
}
