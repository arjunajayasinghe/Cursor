import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

export function BlendingPage() {
  const [params] = useSearchParams();
  const fromBatch = params.get("fromBatch");

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">Blending</Typography>
        <Typography color="text.secondary">
          Samples received from collection unlock blend-sheet work. Full blend sheet creation comes next.
        </Typography>
      </div>

      <Alert severity="info">
        Gate is live: only collection batches with all sample boxes <strong>Received</strong> may enter blending.
        Blend sheet list, inventory allocation, and Pre-Approval reservations are the next build.
      </Alert>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Ready to start
        </Typography>
        {fromBatch ? (
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Opened from collection batch <code>{fromBatch}</code>. Received sample lots for this sale are eligible for
            blend composition.
          </Typography>
        ) : (
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Open a collection batch, generate box numbers, print labels, mark boxes received, then continue here.
          </Typography>
        )}
        <Button component={RouterLink} to={fromBatch ? `/collections/${fromBatch}` : "/collections"} variant="outlined">
          {fromBatch ? "Back to collection" : "Open collections"}
        </Button>
      </Paper>
    </Stack>
  );
}
