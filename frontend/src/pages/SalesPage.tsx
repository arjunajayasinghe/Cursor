import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { listSales } from "../api/client";
import { formatSaleDate } from "../catalogue";

export function SalesPage() {
  const navigate = useNavigate();
  const sales = useQuery({ queryKey: ["sales"], queryFn: listSales });

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}
      >
        <div>
          <Typography variant="h4">Auctions</Typography>
          <Typography color="text.secondary">
            Open a sale for auction results or the pre-auction catalogue tab. Use Catalogues in the menu to check
            upload status and failure reasons.
          </Typography>
        </div>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" component={RouterLink} to="/upload-sales">
            Upload sales
          </Button>
          <Button variant="contained" component={RouterLink} to="/upload">
            Upload catalogues
          </Button>
        </Stack>
      </Stack>

      {sales.isPending ? <CircularProgress aria-label="Loading auctions" /> : null}
      {sales.isError ? (
        <Alert severity="error" action={<Button onClick={() => sales.refetch()}>Retry</Button>}>
          {sales.error.message}
        </Alert>
      ) : null}

      {sales.data && sales.data.length === 0 ? (
        <Paper sx={{ p: 4 }}>
          <Typography>No auctions yet. Upload the eight broker catalogues to open a sale.</Typography>
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
                <TableRow
                  key={sale.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => navigate(`/auctions/${sale.id}`)}
                >
                  <TableCell sx={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: "1.05rem" }}>
                    {sale.saleNumber}/{sale.year}
                  </TableCell>
                  <TableCell>{sale.centre}</TableCell>
                  <TableCell>{formatSaleDate(sale.saleDate)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={sale.status} color={sale.status === "Open" ? "success" : "default"} />
                  </TableCell>
                  <TableCell align="right">{sale.lotCount}</TableCell>
                  <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => navigate(`/auctions/${sale.id}`)}
                    >
                      Open board
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
