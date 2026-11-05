import { Alert, Button, Chip, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { listSales } from "../api/client";
import { formatSaleDate } from "../catalogue";

export function SalesPage() {
  const sales = useQuery({ queryKey: ["sales"], queryFn: listSales });

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}>
        <BoxHeading
          title="Pre-auction catalogues"
          lede="Broker offer books accepted for each sale. Open a sale to browse lot details."
        />
        <Button variant="contained" component={RouterLink} to="/upload">
          Upload catalogues
        </Button>
      </Stack>
      {sales.isPending ? <CircularProgress aria-label="Loading sales" /> : null}
      {sales.isError ? (
        <Alert severity="error" action={<Button onClick={() => sales.refetch()}>Retry</Button>}>
          {sales.error.message}
        </Alert>
      ) : null}
      {sales.data && sales.data.length === 0 ? (
        <Paper sx={{ p: 4 }}>
          <Typography>No pre-auction catalogues yet. Upload the eight broker files to open a sale.</Typography>
        </Paper>
      ) : null}
      {sales.data && sales.data.length > 0 ? (
        <Paper sx={{ overflow: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Sale</TableCell>
                <TableCell>Centre</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Lots</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sales.data.map((sale) => (
                <TableRow key={sale.id} hover>
                  <TableCell>
                    <Button component={RouterLink} to={`/sales/${sale.id}`} sx={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: "1.05rem" }}>
                      {sale.saleNumber}/{sale.year}
                    </Button>
                  </TableCell>
                  <TableCell>{sale.centre}</TableCell>
                  <TableCell>{formatSaleDate(sale.saleDate)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={sale.status} color={sale.status === "Open" ? "success" : "default"} />
                  </TableCell>
                  <TableCell align="right">{sale.lotCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      ) : null}
    </Stack>
  );
}

function BoxHeading({ title, lede }: { title: string; lede: string }) {
  return (
    <div>
      <Typography variant="h4">{title}</Typography>
      <Typography color="text.secondary">{lede}</Typography>
    </div>
  );
}
