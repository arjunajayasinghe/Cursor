import {
  Autocomplete,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useDeferredValue, useMemo, useState } from "react";
import type { Lot } from "../api/client";
import { brokerName, brokers, formatQuantity } from "../catalogue";

type BrokerFilter = "ALL" | (typeof brokers)[number]["code"];
type ResultFilter = "ALL" | "SOLD" | "UNSOLD";

type BrokerOption = { value: BrokerFilter; label: string };

type Props = {
  lots: Lot[];
  currency?: string;
};

function isSold(lot: Lot) {
  return (
    (lot.soldPricePerKg != null && Number(lot.soldPricePerKg) > 0) ||
    Boolean(lot.buyerCode && String(lot.buyerCode).trim())
  );
}

export function AuctionBoard({ lots, currency = "" }: Props) {
  const [brokerFilter, setBrokerFilter] = useState<BrokerFilter>("ALL");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const brokerOptions = useMemo<BrokerOption[]>(() => {
    const counts = new Map<string, number>();
    for (const lot of lots) {
      const code = String(lot.broker);
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return [
      { value: "ALL", label: `All brokers (${lots.length.toLocaleString("en-GB")})` },
      ...brokers.map((broker) => ({
        value: broker.code as BrokerFilter,
        label: `${broker.code} · ${broker.name} (${(counts.get(broker.code) ?? 0).toLocaleString("en-GB")})`,
      })),
    ];
  }, [lots]);

  const selectedBroker = brokerOptions.find((option) => option.value === brokerFilter) ?? brokerOptions[0];

  const filtered = useMemo(() => {
    return lots.filter((lot) => {
      if (brokerFilter !== "ALL" && String(lot.broker) !== brokerFilter) return false;
      if (resultFilter === "SOLD" && !isSold(lot)) return false;
      if (resultFilter === "UNSOLD" && isSold(lot)) return false;
      if (!deferredQuery) return true;
      const haystack = [
        String(lot.broker),
        String(lot.lotNumber),
        lot.gardenMark,
        lot.grade,
        lot.invoiceNumber,
        lot.factoryCode,
        lot.buyerCode,
        lot.soldPricePerKg == null ? "" : String(lot.soldPricePerKg),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(deferredQuery);
    });
  }, [lots, brokerFilter, resultFilter, deferredQuery]);

  const soldCount = useMemo(
    () =>
      lots.filter(
        (lot) =>
          (brokerFilter === "ALL" || String(lot.broker) === brokerFilter) && isSold(lot),
      ).length,
    [lots, brokerFilter],
  );

  const pageRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  function changeBroker(next: BrokerFilter) {
    setBrokerFilter(next);
    setPage(0);
  }

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Autocomplete
            sx={{ minWidth: 280, flex: 1 }}
            options={brokerOptions}
            value={selectedBroker}
            disableClearable
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(option, value) => option.value === value.value}
            onChange={(_, option) => changeBroker(option.value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Broker"
                placeholder="Search broker…"
                helperText="All brokers, or pick one"
              />
            )}
          />

          <TextField
            select
            label="Results"
            value={resultFilter}
            onChange={(event) => {
              setResultFilter(event.target.value as ResultFilter);
              setPage(0);
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="ALL">All lots</MenuItem>
            <MenuItem value="SOLD">Sold only</MenuItem>
            <MenuItem value="UNSOLD">Unsold only</MenuItem>
          </TextField>

          <TextField
            label="Search lots"
            placeholder="Lot, garden, grade, buyer, price…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            sx={{ flex: 1.4 }}
            helperText={`${filtered.length.toLocaleString("en-GB")} shown · ${soldCount.toLocaleString("en-GB")} sold`}
          />
        </Stack>
      </Paper>

      <Typography variant="body2" color="text.secondary">
        {brokerFilter === "ALL"
          ? "Auction board · every broker"
          : `Auction board · ${brokerName(brokerFilter)}`}
      </Typography>

      {filtered.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">No lots match this broker / search.</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {brokerFilter === "ALL" ? <TableCell>Broker</TableCell> : null}
                <TableCell>Lot</TableCell>
                <TableCell>Garden</TableCell>
                <TableCell>Grade</TableCell>
                <TableCell align="right">Bags</TableCell>
                <TableCell align="right">Net kg</TableCell>
                <TableCell align="right">Sold / kg {currency ? `(${currency})` : ""}</TableCell>
                <TableCell>Buyer</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.map((lot) => {
                const sold = isSold(lot);
                return (
                  <TableRow key={lot.id} hover selected={sold}>
                    {brokerFilter === "ALL" ? <TableCell>{String(lot.broker)}</TableCell> : null}
                    <TableCell sx={{ fontWeight: 600 }}>{lot.lotNumber}</TableCell>
                    <TableCell>{lot.gardenMark || "—"}</TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={lot.grade || "—"} />
                    </TableCell>
                    <TableCell align="right">{lot.bags || "—"}</TableCell>
                    <TableCell align="right">{formatQuantity(lot.netWeightKg, 1)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {sold ? formatQuantity(lot.soldPricePerKg, 2) : "—"}
                    </TableCell>
                    <TableCell>{sold ? lot.buyerCode || "—" : "—"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={sold ? "success" : "default"}
                        label={sold ? "Sold" : "Unsold"}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_, next) => setPage(next)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[25, 50, 100, 250]}
          />
        </Paper>
      )}
    </Stack>
  );
}
