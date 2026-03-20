import { Button } from "@mui/material";
import { useMerkleTree } from "./MerkleTreeProvider.tsx";
import { useMerklePath, addNodeToProof } from "./MerkleProofsProvider.tsx";
import { TreePart, TreeLeaf, MerkleProofByTx } from "./merkle-tree-data";

function partitionInto<T>(arr: T[], n: number): T[][] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  const weights = Array.from({ length: n }, () => Math.random() + 0.2);
  const total = weights.reduce((s, w) => s + w, 0);
  const sizes = weights.map((w) => Math.max(1, Math.round((w / total) * shuffled.length)));
  const diff = shuffled.length - sizes.reduce((s, v) => s + v, 0);
  sizes[sizes.length - 1] = Math.max(1, sizes[sizes.length - 1] + diff);
  const groups: T[][] = [];
  let cursor = 0;
  for (const size of sizes) {
    groups.push(shuffled.slice(cursor, cursor + size));
    cursor += size;
  }
  return groups;
}

function collectLeaves(node: TreePart): TreeLeaf[] {
  if (!("left" in node && "right" in node)) {
    return node.duplicated ? [] : [node];
  }
  return [...collectLeaves(node.left), ...collectLeaves(node.right)];
}

// Traverse tree root→leaf, collecting sibling nodes into the proof along the way.
function buildProofForTxid(
  txHash: string,
  node: TreePart,
  proof: MerkleProofByTx,
): boolean {
  if (!("left" in node && "right" in node)) {
    if (node.hash === txHash && !node.duplicated) {
      addNodeToProof(txHash, node, proof);
      return true;
    }
    return false;
  }
  if (buildProofForTxid(txHash, node.left, proof)) {
    addNodeToProof(txHash, node.right, proof);
    return true;
  }
  if (buildProofForTxid(txHash, node.right, proof)) {
    addNodeToProof(txHash, node.left, proof);
    return true;
  }
  return false;
}

export const RandomTxSelector = () => {
  const { tree } = useMerkleTree();
  const { setProof, setPartitions, setPartitionCount } = useMerklePath();

  const handleClick = () => {
    const leaves = collectLeaves(tree);
    if (leaves.length === 0) return;

    const randomCount = Math.floor(Math.random() * 99) + 2; // 2–100
    setPartitionCount(randomCount);
    const groups = partitionInto(leaves, Math.min(randomCount, leaves.length));
    const newPartitions = groups.map((g) => g.map((l) => l.hash));

    const newProof: MerkleProofByTx = {};
    for (const leaf of groups[0]) {
      buildProofForTxid(leaf.hash, tree, newProof);
    }
    setProof(newProof);
    setPartitions(newPartitions);
  };

  return (
    <Button
      variant="outlined"
      size="small"
      onClick={handleClick}
      sx={{ textTransform: "none", fontWeight: 600 }}
    >
      Emulate Merkle Service
    </Button>
  );
};
