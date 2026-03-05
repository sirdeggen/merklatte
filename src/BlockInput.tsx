import { useState } from 'react';
import { TextField, Button, Box, Typography, Switch, FormControlLabel, CircularProgress, Alert } from '@mui/material';
import { useBlockData } from './BlockDataProvider';

export const BlockInput = () => {
  const [heightInput, setHeightInput] = useState('850000'); // Recent BSV block
  const { fetchBlock, loading, error, useFakeData, setUseFakeData, blockData } = useBlockData();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const height = parseInt(heightInput);
    if (isNaN(height)) return;
    await fetchBlock(height);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Enter Block Height
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'end', flexWrap: 'wrap' }}>
        <TextField
          label="Block Height"
          value={heightInput}
          onChange={(e) => setHeightInput(e.target.value)}
          variant="outlined"
          size="small"
          sx={{ minWidth: 200 }}
          disabled={loading}
        />
        <Button type="submit" variant="contained" disabled={loading} sx={{ minHeight: 56 }}>
          {loading ? <CircularProgress size={24} /> : 'Load Block'}
        </Button>
        <FormControlLabel
          control={<Switch checked={useFakeData} onChange={(e) => setUseFakeData(e.target.checked)} />}
          label="Use Fake Data (Toggle for Testing)"
        />
      </Box>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      {blockData && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Loaded Block #{blockData.height} ({blockData.txids.length} txs) - Root: {blockData.merkleRoot.slice(0,16)}...
        </Alert>
      )}
    </Box>
  );
};
