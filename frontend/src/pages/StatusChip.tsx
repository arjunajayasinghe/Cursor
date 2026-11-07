import { Chip } from "@mui/material";

export function StatusChip({ status }: { status: string }) {
  const color =
    status === "Completed" || status === "Open"
      ? "success"
      : status === "Failed"
        ? "error"
        : status === "Processing"
          ? "info"
          : "default";
  return <Chip size="small" label={status} color={color} />;
}
