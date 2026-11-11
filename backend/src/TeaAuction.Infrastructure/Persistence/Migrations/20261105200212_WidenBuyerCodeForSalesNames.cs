using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeaAuction.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class WidenBuyerCodeForSalesNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "buyer_code",
                table: "lots",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(40)",
                oldMaxLength: 40);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "buyer_code",
                table: "lots",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(120)",
                oldMaxLength: 120);
        }
    }
}
