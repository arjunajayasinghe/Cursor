using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeaAuction.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ExpandCatalogueLotDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "category",
                table: "lots",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "factory_code",
                table: "lots",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "net_per_bag_kg",
                table: "lots",
                type: "numeric(12,3)",
                precision: 12,
                scale: 3,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "package_type",
                table: "lots",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "selling_mark",
                table: "lots",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "source_line",
                table: "lots",
                type: "character varying(400)",
                maxLength: 400,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "warehouse_or_basis",
                table: "lots",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "category",
                table: "lots");

            migrationBuilder.DropColumn(
                name: "factory_code",
                table: "lots");

            migrationBuilder.DropColumn(
                name: "net_per_bag_kg",
                table: "lots");

            migrationBuilder.DropColumn(
                name: "package_type",
                table: "lots");

            migrationBuilder.DropColumn(
                name: "selling_mark",
                table: "lots");

            migrationBuilder.DropColumn(
                name: "source_line",
                table: "lots");

            migrationBuilder.DropColumn(
                name: "warehouse_or_basis",
                table: "lots");
        }
    }
}
