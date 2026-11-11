import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

const links = [
  { to: "/blending/sheets", label: "Blend Sheet List", hint: "All blend sheets" },
  { to: "/blending/new", label: "Create Blend Sheet", hint: "Allocate collected lots" },
  { to: "/blending/sheets?status=TempAllocated", label: "Pending Blend Approvals", hint: "Temp allocated — await confirm" },
  { to: "/blending/sheets?status=Confirmed", label: "Approved Blend Sheets", hint: "Confirmed compositions" },
  { to: "/blending/new", label: "Blend Inventory Allocation", hint: "Same as create — pick lots & qty" },
  { to: "/blending/sheets", label: "Blend History", hint: "Full register" },
] as const;

export function BlendingPage() {
  const [params] = useSearchParams();
  const fromBatch = params.get("fromBatch");

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="overline" color="text.secondary">
          Tea Operations → Blending Management
        </Typography>
        <Typography variant="h4">Blending</Typography>
        <Typography color="text.secondary">
          Use collected sample boxes/lots (whole collection batch need not be finished). Temp allocate qty, then confirm
          when allocated qty equals estimated qty.
        </Typography>
      </div>

      {fromBatch ? (
        <Alert severity="info">
          Opened from collection batch <code>{fromBatch}</code>. Collected lots from that sale are in the inventory
          picker when you create a blend sheet.
        </Alert>
      ) : null}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        useFlexGap
        sx={{ flexWrap: "wrap" }}
      >
        {links.map((link) => (
          <Paper key={link.label} sx={{ p: 2, minWidth: 220, flex: "1 1 220px" }}>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              {link.label}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {link.hint}
            </Typography>
            <Button component={RouterLink} to={link.to} variant="contained" size="small">
              Open
            </Button>
          </Paper>
        ))}
      </Stack>

      <Button component={RouterLink} to="/collections" variant="outlined" sx={{ alignSelf: "flex-start" }}>
        Back to collection
      </Button>
    </Stack>
  );
}
