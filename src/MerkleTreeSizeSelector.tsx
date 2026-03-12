import { FC, useState } from "react";
import { useMerkleTree } from "./MerkleTreeProvider.tsx";
import { Slider, Typography, Box } from "@mui/material";
import { isArray } from "lodash";

const marks = [
  { value: 2, label: "2" },
  { value: 4, label: "4" },
  { value: 8, label: "8" },
  { value: 16, label: "16" },
  { value: 32, label: "32" },
];

export const MerkleTreeSizeSelector: FC = () => {
  const { setTreeOfSize } = useMerkleTree();
  const [size, setSize] = useState<number>(2);

  const changeSize = (_: Event, value: number | number[]) => {
    if (isArray(value)) return;
    setSize(value);
    setTreeOfSize(value);
  };

  return (
    <Box sx={{ px: 1 }}>
      <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 0.5 }}>
        Transactions in tree: {size}
      </Typography>
      <Slider
        aria-label="Number of transactions"
        step={1}
        marks={marks}
        min={2}
        max={32}
        valueLabelDisplay="auto"
        value={size}
        onChange={changeSize}
        size="small"
      />
    </Box>
  );
};
