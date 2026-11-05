import { Alert, Button, Chip, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { listSales } from "../api/client";
import { formatSaleDate } from "../catalogue";

export function SalesPage() {
  const navigate = useNavigate();
  const sales = useQuery({ queryKey: ["sales"], queryFn: listSales });

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}>
        <BoxHeading
          title="Auction catalogues"
          lede="Open a sale for the auction view (all brokers or one). Sales files add sold price and buyer on the same lots."
        />
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" component={RouterLink} to="/uploads">
            Uploads
          </Button>
          <Button variant="outlined" component={RouterLink} to="/upload-sales">
            Upload sales
          </Button>
          <Button variant="contained" component={RouterLink} to="/upload">
            Upload catalogues
          </Button>
        </Stack>
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
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {sales.data.map((sale) => (
                <TableRow key={sale.id} hover>
                  <TableCell>
                    <Button
                      onClick={() => navigate(`/sales/${sale.id}`)}
                      sx={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: "1.05rem" }}
                    >
                      {sale.saleNumber}/{sale.year}
                    </Button>
                  </TableCell>
                  <TableCell>{sale.centre}</TableCell>
                  <TableCell>{formatSaleDate(sale.saleDate)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={sale.status} color={sale.status === "Open" ? "success" : "default"} />
                  </TableCell>
                  <TableCell align="right">{sale.lotCount}</TableCell>
                  <TableCell align="right">
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => navigate(`/sales/${sale.id}`)}
                    >
                      Auction view
                    </Button>
                  </TableCell>
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
