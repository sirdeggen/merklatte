import { useState, useEffect } from "react";
import { TextField, Button, Box, CircularProgress, Alert } from "@mui/material";
import { useBlockData } from "./BlockDataProvider";
import { RandomTxSelector } from "./RandomTxSelector.tsx";
import { useMerklePath } from "./MerkleProofsProvider.tsx";

export const BlockInput = () => {
  const [heightInput, setHeightInput] = useState("865000");
  const { fetchBlock, loading, error, blockData } = useBlockData();
  const { partitionCount, setPartitionCount } = useMerklePath();
  const maxBusinesses = blockData?.txids.length ?? 100;

  useEffect(() => {
    if (partitionCount > maxBusinesses) setPartitionCount(maxBusinesses);
  }, [maxBusinesses]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const height = parseInt(heightInput);
    if (isNaN(height)) return;
    await fetchBlock(height);
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        <TextField
          label="Block Height"
          value={heightInput}
          onChange={(e) => setHeightInput(e.target.value)}
          variant="outlined"
          size="small"
          sx={{ width: 160 }}
          disabled={loading}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          size="small"
          sx={{ textTransform: "none", fontWeight: 600, px: 2.5 }}
        >
          {loading ? <CircularProgress size={18} /> : "Load Block"}
        </Button>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TextField
            label="Businesses"
            type="number"
            value={partitionCount}
            onChange={(e) => {
              const v = Math.max(2, Math.min(maxBusinesses, Number.parseInt(e.target.value) || 2));
              setPartitionCount(v);
            }}
            inputProps={{ min: 2, max: maxBusinesses }}
            variant="outlined"
            size="small"
            sx={{ width: 110 }}
          />
          <RandomTxSelector />
        </Box>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }} variant="outlined">
          {error}
        </Alert>
      )}
    </Box>
  );
};
