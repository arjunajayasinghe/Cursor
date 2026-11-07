using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeaAuction.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBlendOptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_blend_sheet_lines_blend_sheet_id_collection_lot_id",
                table: "blend_sheet_lines");

            migrationBuilder.AddColumn<string>(
                name: "active_option_key",
                table: "blend_sheets",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "A");

            migrationBuilder.AddColumn<string>(
                name: "option_key",
                table: "blend_sheet_lines",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "A");

            migrationBuilder.CreateIndex(
                name: "IX_blend_sheet_lines_blend_sheet_id_option_key_collection_lot_~",
                table: "blend_sheet_lines",
                columns: new[] { "blend_sheet_id", "option_key", "collection_lot_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_blend_sheet_lines_blend_sheet_id_option_key_collection_lot_~",
                table: "blend_sheet_lines");

            migrationBuilder.DropColumn(
                name: "active_option_key",
                table: "blend_sheets");

            migrationBuilder.DropColumn(
                name: "option_key",
                table: "blend_sheet_lines");

            migrationBuilder.CreateIndex(
                name: "IX_blend_sheet_lines_blend_sheet_id_collection_lot_id",
                table: "blend_sheet_lines",
                columns: new[] { "blend_sheet_id", "collection_lot_id" },
                unique: true);
        }
    }
}
