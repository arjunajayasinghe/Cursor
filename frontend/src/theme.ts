import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: { main: "#1f4d3a", contrastText: "#f6f1e6" },
    secondary: { main: "#8c3f2a" },
    background: { default: "#f3efe4", paper: "#fffdf8" },
    text: { primary: "#1c1915", secondary: "#5c564c" },
    divider: "#e4dccb",
  },
  typography: {
    fontFamily: '"Source Sans 3", "Segoe UI", sans-serif',
    h4: { fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 600 },
    h5: { fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 600 },
    h6: { fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
});
