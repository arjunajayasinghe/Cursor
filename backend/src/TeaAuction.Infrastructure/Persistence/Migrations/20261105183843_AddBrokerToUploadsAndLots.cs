using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeaAuction.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBrokerToUploadsAndLots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_lots_sale_id_lot_number",
                table: "lots");

            migrationBuilder.AddColumn<string>(
                name: "broker",
                table: "upload_batches",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "broker",
                table: "lots",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_lots_sale_id_broker_lot_number",
                table: "lots",
                columns: new[] { "sale_id", "broker", "lot_number" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_lots_sale_id_broker_lot_number",
                table: "lots");

            migrationBuilder.DropColumn(
                name: "broker",
                table: "upload_batches");

            migrationBuilder.DropColumn(
                name: "broker",
                table: "lots");

            migrationBuilder.CreateIndex(
                name: "IX_lots_sale_id_lot_number",
                table: "lots",
                columns: new[] { "sale_id", "lot_number" },
                unique: true);
        }
    }
}
