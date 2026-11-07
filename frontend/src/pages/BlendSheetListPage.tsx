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
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { listBlendSheets } from "../api/client";

export function BlendSheetListPage() {
  const [params] = useSearchParams();
  const status = params.get("status") || undefined;
  const sheets = useQuery({
    queryKey: ["blends", status ?? "all"],
    queryFn: () => listBlendSheets(status),
  });

  if (sheets.isPending) return <CircularProgress aria-label="Loading blend sheets" />;
  if (sheets.isError) {
    return (
      <Alert severity="error" action={<Button onClick={() => sheets.refetch()}>Retry</Button>}>
        {sheets.error.message}
      </Alert>
    );
  }

  const rows = sheets.data ?? [];
  const title =
    status === "TempAllocated"
      ? "Pending blend approvals"
      : status === "Confirmed"
        ? "Approved blend sheets"
        : "Blend sheet list";

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
        <div>
          <Typography variant="overline" color="text.secondary">
            Blending Management
          </Typography>
          <Typography variant="h4">{title}</Typography>
        </div>
        <Stack direction="row" spacing={1}>
          <Button component={RouterLink} to="/blending" size="small" variant="outlined">
            Menu
          </Button>
          <Button component={RouterLink} to="/blending/new" variant="contained">
            Create blend sheet
          </Button>
        </Stack>
      </Stack>

      {rows.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">No blend sheets yet.</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Blend No.</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Product</TableCell>
                <TableCell>SO</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Target kg</TableCell>
                <TableCell align="right">Allocated kg</TableCell>
                <TableCell align="right">WAVG cost</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ fontWeight: 700 }}>{row.blendNumber}</TableCell>
                  <TableCell>{row.blendDate}</TableCell>
                  <TableCell>{row.productName}</TableCell>
                  <TableCell>{row.salesOrderRef || "—"}</TableCell>
                  <TableCell>
                    <Chip size="small" label={row.status} />
                  </TableCell>
                  <TableCell align="right">{Number(row.targetQuantityKg).toFixed(2)}</TableCell>
                  <TableCell align="right">{Number(row.allocatedQuantityKg).toFixed(2)}</TableCell>
                  <TableCell align="right">
                    {row.weightedAverageCostPerKg == null
                      ? "—"
                      : Number(row.weightedAverageCostPerKg).toFixed(2)}
                  </TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to={`/blending/sheets/${row.id}`} size="small">
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
}
