import { MerkleTreeView } from "./MerkleTreeView.tsx";
import { MerkleTreeProvider } from "./MerkleTreeProvider.tsx";
import { MerkleTreeSizeSelector } from "./MerkleTreeSizeSelector.tsx";
import { MerkleProofProvider } from "./MerkleProofsProvider.tsx";
import { ResetProvider } from "./useReset.tsx";
import { TscMerkleProofsView } from "./TscMerkleProofsView.tsx";
import { BsvUnifiedMerklePathView } from "./BsvUnifiedMerklePathView.tsx";
import { 
  Container, 
  Typography, 
  Paper, 
  Box, 
  ThemeProvider, 
  createTheme,
  Alert
} from "@mui/material";
import { BlockDataProvider } from "./BlockDataProvider.tsx";
import { BlockInput } from "./BlockInput.tsx";
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00ff88',
    },
    background: {
      default: '#0a0a0a',
      paper: '#1a1a1a',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg" sx={{ py: 4, minHeight: '100vh' }}>
        <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
          <Typography variant="h2" component="h1" gutterBottom align="center" sx={{ color: 'primary.main', mb: 4 }}>
            BSV Merkle Path Visualizer
          </Typography>
          <Typography variant="h5" align="center" sx={{ mb: 4, opacity: 0.8 }}>
            Visualize BUMP and Merkle Proofs with stunning interactive trees
          </Typography>
        </Paper>
        <ResetProvider>
          <BlockDataProvider>
            <MerkleProofProvider>
              <Paper elevation={2} sx={{ p: 4, overflow: 'hidden' }}>
                <BlockInput />
              <MerkleTreeSizeSelector />
                <Box sx={{ overflow: 'auto', mt: 2, maxHeight: 600 }}>
                  <MerkleTreeView />
                </Box>
              </Paper>
              <Box sx={{ mt: 4, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Paper elevation={2} sx={{ p: 3, flex: 1, minWidth: 400 }}>
                  <BsvUnifiedMerklePathView />
                </Paper>
                <Paper elevation={2} sx={{ p: 3, flex: 1, minWidth: 400 }}>
                  <TscMerkleProofsView />
                </Paper>
              </Box>
            </MerkleProofProvider>
          </BlockDataProvider>
          </MerkleTreeProvider>
        </ResetProvider>
      </Container>
    </ThemeProvider>
  );
}

export default App;
