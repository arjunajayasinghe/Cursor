using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeaAuction.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSampleBoxesAndNumberSeries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "sample_box_id",
                table: "collection_lots",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "number_series",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    prefix = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    year = table.Column<int>(type: "integer", nullable: false),
                    next_number = table.Column<int>(type: "integer", nullable: false),
                    pad_length = table.Column<int>(type: "integer", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_number_series", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "sample_boxes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    collection_batch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    box_number = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    lot_count = table.Column<int>(type: "integer", nullable: false),
                    bag_count = table.Column<int>(type: "integer", nullable: false),
                    net_weight_kg = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    warehouse_or_basis = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    collector_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    remarks = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    printed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    print_count = table.Column<int>(type: "integer", nullable: false),
                    received_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    received_by = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sample_boxes", x => x.id);
                    table.ForeignKey(
                        name: "FK_sample_boxes_collection_batches_collection_batch_id",
                        column: x => x.collection_batch_id,
                        principalTable: "collection_batches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_collection_lots_sample_box_id",
                table: "collection_lots",
                column: "sample_box_id");

            migrationBuilder.CreateIndex(
                name: "IX_number_series_code_year",
                table: "number_series",
                columns: new[] { "code", "year" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sample_boxes_box_number",
                table: "sample_boxes",
                column: "box_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sample_boxes_collection_batch_id",
                table: "sample_boxes",
                column: "collection_batch_id");

            migrationBuilder.AddForeignKey(
                name: "FK_collection_lots_sample_boxes_sample_box_id",
                table: "collection_lots",
                column: "sample_box_id",
                principalTable: "sample_boxes",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_collection_lots_sample_boxes_sample_box_id",
                table: "collection_lots");

            migrationBuilder.DropTable(
                name: "number_series");

            migrationBuilder.DropTable(
                name: "sample_boxes");

            migrationBuilder.DropIndex(
                name: "IX_collection_lots_sample_box_id",
                table: "collection_lots");

            migrationBuilder.DropColumn(
                name: "sample_box_id",
                table: "collection_lots");
        }
    }
}
