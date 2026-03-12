import { Button } from "@mui/material";
import { useMerkleTree } from "./MerkleTreeProvider.tsx";
import { useMerklePath, addNodeToProof } from "./MerkleProofsProvider.tsx";
import { TreePart, TreeLeaf, MerkleProofByTx } from "./merkle-tree-data";

function collectLeaves(node: TreePart): TreeLeaf[] {
  if (!("left" in node && "right" in node)) {
    return node.duplicated ? [] : [node as TreeLeaf];
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
  const { setProof } = useMerklePath();

  const handleClick = () => {
    const leaves = collectLeaves(tree);
    if (leaves.length === 0) return;

    const count = Math.max(
      2,
      Math.floor(leaves.length * Math.max(Math.random(), 0.1)),
    );
    const shuffled = [...leaves].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    const proof: MerkleProofByTx = {};
    for (const leaf of selected) {
      buildProofForTxid(leaf.hash, tree, proof);
    }
    setProof(proof);
  };

  return (
    <Button
      variant="outlined"
      size="small"
      onClick={handleClick}
      sx={{ textTransform: "none", fontWeight: 600 }}
    >
      Select Random Txs
    </Button>
  );
};
