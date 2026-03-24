import { useState, useCallback } from "react";
import {
  Box,
  TextField,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  Alert,
  IconButton,
  Tooltip,
} from "@mui/material";
import { MerklePath } from "@bsv/sdk";
import { useMerkleTree, merklePathToTree } from "./MerkleTreeProvider.tsx";

type BumpFormat = "hex" | "base64";

interface BumpImportPanelProps {
  isImportMode: boolean;
}

export const BumpImportPanel = ({ isImportMode }: BumpImportPanelProps) => {
  const [format, setFormat] = useState<BumpFormat>("hex");
  const [bumpInput, setBumpInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [computedRoot, setComputedRoot] = useState<string | null>(null);
  const [expectedRoot, setExpectedRoot] = useState("");
  const [validationResult, setValidationResult] = useState<
    "match" | "mismatch" | null
  >(null);
  const [blockHeight, setBlockHeight] = useState<number | null>(null);

  const { setImportedTree, setImportedMerklePath, clearImport } =
    useMerkleTree();

  const parseBump = useCallback(() => {
    setError(null);
    setComputedRoot(null);
    setValidationResult(null);
    setBlockHeight(null);

    const input = bumpInput.trim();
    if (!input) {
      setError("Please paste a BUMP string.");
      return;
    }

    try {
      let mp: MerklePath;

      if (format === "hex") {
        mp = MerklePath.fromHex(input);
      } else {
        // Base64 decode
        const binaryStr = atob(input);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        mp = MerklePath.fromBinary(bytes);
      }

      // Convert to visual tree
      const tree = merklePathToTree(mp);
      setImportedTree(tree);
      setImportedMerklePath(mp);
      setBlockHeight(mp.blockHeight);

      // Auto-compute merkle root from the first txid-flagged leaf
      const txidLeaf = mp.path[0]?.find((leaf) => leaf.txid && leaf.hash);
      if (txidLeaf?.hash) {
        try {
          const root = mp.computeRoot(txidLeaf.hash);
          setComputedRoot(root);
        } catch (e) {
          setComputedRoot(null);
          console.warn("Could not compute root:", e);
        }
      } else {
        setComputedRoot(null);
      }
    } catch (e) {
      setError(
        `Failed to parse BUMP (${format}): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      setImportedTree(null);
      setImportedMerklePath(null);
    }
  }, [bumpInput, format, setImportedTree, setImportedMerklePath]);

  const handleValidate = useCallback(() => {
    if (!computedRoot || !expectedRoot.trim()) {
      setValidationResult(null);
      return;
    }
    const match =
      computedRoot.toLowerCase() === expectedRoot.trim().toLowerCase();
    setValidationResult(match ? "match" : "mismatch");
  }, [computedRoot, expectedRoot]);

  const handleClear = useCallback(() => {
    setBumpInput("");
    setError(null);
    setComputedRoot(null);
    setExpectedRoot("");
    setValidationResult(null);
    setBlockHeight(null);
    clearImport();
  }, [clearImport]);

  return (
    <Box
      sx={{
        px: { xs: 1, md: 2 },
        pt: 1.5,
        pb: 1,
      }}
    >
      <Box
        sx={{
          bgcolor: "#1a1a1e",
          border: "1px solid #27272a",
          borderRadius: 2,
          p: 2,
        }}
      >
        {/* Header row */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1.5,
          }}
        >
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: "#a1a1aa" }}
          >
            Import BUMP
          </Typography>

          {isImportMode && (
            <Tooltip title="Clear import and return to block mode">
              <IconButton
                size="small"
                onClick={handleClear}
                sx={{ color: "#71717a" }}
              >
                <span style={{ fontSize: "1rem", lineHeight: 1 }}>
                  &#x2715;
                </span>
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Format toggle + input row */}
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          <ToggleButtonGroup
            value={format}
            exclusive
            onChange={(_, val) => val && setFormat(val as BumpFormat)}
            size="small"
            sx={{
              flexShrink: 0,
              "& .MuiToggleButton-root": {
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.75rem",
                px: 1.5,
                py: 0.5,
                color: "#a1a1aa",
                borderColor: "#3f3f46",
                "&.Mui-selected": {
                  color: "#6ee7b7",
                  bgcolor: "rgba(110,231,183,0.08)",
                  borderColor: "#6ee7b7",
                },
              },
            }}
          >
            <ToggleButton value="hex">Hex</ToggleButton>
            <ToggleButton value="base64">Base64</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            value={bumpInput}
            onChange={(e) => {
              setBumpInput(e.target.value);
              setError(null);
              setValidationResult(null);
            }}
            placeholder={
              format === "hex"
                ? "Paste BUMP hex string..."
                : "Paste BUMP base64 string..."
            }
            variant="outlined"
            size="small"
            multiline
            maxRows={3}
            sx={{
              flex: 1,
              "& .MuiOutlinedInput-root": {
                fontFamily: "monospace",
                fontSize: "0.75rem",
              },
            }}
          />

          <Button
            variant="contained"
            size="small"
            onClick={parseBump}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              px: 2.5,
              flexShrink: 0,
              alignSelf: "flex-start",
            }}
          >
            Visualize
          </Button>
        </Box>

        {/* Error */}
        {error && (
          <Alert
            severity="error"
            variant="outlined"
            sx={{ mt: 1.5, fontSize: "0.8rem" }}
          >
            {error}
          </Alert>
        )}

        {/* Computed root + validation */}
        {computedRoot && (
          <Box sx={{ mt: 1.5 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                mb: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: "#71717a", flexShrink: 0 }}
              >
                Computed Root:
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontFamily: "monospace",
                  color: "#6ee7b7",
                  wordBreak: "break-all",
                }}
              >
                {computedRoot}
              </Typography>
              {blockHeight != null && (
                <Typography
                  variant="caption"
                  sx={{ color: "#52525b", ml: 1, flexShrink: 0 }}
                >
                  (block {blockHeight})
                </Typography>
              )}
            </Box>

            {/* Validation row */}
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField
                value={expectedRoot}
                onChange={(e) => {
                  setExpectedRoot(e.target.value);
                  setValidationResult(null);
                }}
                placeholder="Paste expected Merkle root to validate..."
                variant="outlined"
                size="small"
                sx={{
                  flex: 1,
                  "& .MuiOutlinedInput-root": {
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                  },
                }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleValidate}
                disabled={!expectedRoot.trim()}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  px: 2,
                  flexShrink: 0,
                  borderColor: "#3f3f46",
                }}
              >
                Validate
              </Button>
              {validationResult === "match" && (
                <Tooltip title="Root matches!">
                  <span
                    style={{
                      color: "#6ee7b7",
                      fontSize: "1.5rem",
                      lineHeight: 1,
                      cursor: "default",
                    }}
                  >
                    &#x2714;
                  </span>
                </Tooltip>
              )}
              {validationResult === "mismatch" && (
                <Tooltip title="Root does NOT match">
                  <span
                    style={{
                      color: "#f87171",
                      fontSize: "1.5rem",
                      lineHeight: 1,
                      cursor: "default",
                    }}
                  >
                    &#x2718;
                  </span>
                </Tooltip>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};
