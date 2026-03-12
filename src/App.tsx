import { MerkleTreeView } from "./MerkleTreeView.tsx";
import { MerkleTreeProvider } from "./MerkleTreeProvider.tsx";
import { MerkleProofProvider } from "./MerkleProofsProvider.tsx";
import { ResetProvider } from "./useReset.tsx";
import { BsvUnifiedMerklePathView } from "./BsvUnifiedMerklePathView.tsx";
import {
  Container,
  Typography,
  Paper,
  Box,
  ThemeProvider,
  createTheme,
} from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { BlockDataProvider } from "./BlockDataProvider.tsx";
import { BlockInput } from "./BlockInput.tsx";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#6ee7b7" },
    secondary: { main: "#f472b6" },
    background: { default: "#0c0c0c", paper: "#161616" },
    text: { primary: "#e4e4e7", secondary: "#a1a1aa" },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 12, border: "1px solid #27272a" },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* Fixed top bar */}
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1200,
          bgcolor: "#111113",
          borderBottom: "1px solid #27272a",
          px: 3,
          py: 1.25,
          display: "flex",
          alignItems: "center",
          gap: 3,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 700, color: "#e4e4e7", whiteSpace: "nowrap", mr: 1 }}
        >
          Merkle Path Visualizer
        </Typography>
        <ResetProvider>
          <BlockDataProvider>
            <MerkleTreeProvider>
              <MerkleProofProvider>
                <BlockInput />

                {/* Page body rendered via a portal-like trick — kept inside providers */}
                <Box
                  sx={{
                    position: "fixed",
                    top: "56px",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    overflow: "auto",
                    px: { xs: 2, md: 4 },
                    py: 3,
                  }}
                >
                  <Paper
                    elevation={0}
                    sx={{ p: 3, mb: 3, overflow: "auto", maxHeight: 520 }}
                  >
                    <MerkleTreeView />
                  </Paper>
                  <BsvUnifiedMerklePathView />
                </Box>
              </MerkleProofProvider>
            </MerkleTreeProvider>
          </BlockDataProvider>
        </ResetProvider>
      </Box>
    </ThemeProvider>
  );
}

export default App;
