import "./MerkleTreeView.css";
import { FC, PropsWithChildren } from "react";
import {
  TreeLeaf,
  TreeNode,
  TreePart,
  MerkleTree,
  DuplicatedNode,
  MerkleProofByTx,
} from "./merkle-tree-data";
import { useMerkleTree } from "./MerkleTreeProvider.tsx";
import { useMerklePath } from "./MerkleProofsProvider.tsx";

// --- Proof-based highlight helpers ---

interface ProofLeaf {
  hash: string;
  txid?: boolean;
  duplicate?: boolean;
  offset: number;
  height: number;
}

function allProofLeaves(proof: MerkleProofByTx): ProofLeaf[] {
  return Object.entries(proof).flatMap(([hash, entry]) => [
    { hash, txid: true, offset: entry.index, height: 0 },
    ...entry.path.map((p) => ({
      hash: p.hash,
      offset: p.offset,
      height: p.height,
      duplicate: p.duplicated,
    })),
  ]);
}

function isInProofPath(part: TreePart, proof: MerkleProofByTx): boolean {
  return allProofLeaves(proof).some(
    (p) => p.height === part.height && p.offset === part.offset,
  );
}

function isRequiredForBump(part: TreePart, proof: MerkleProofByTx): boolean {
  const leaves = allProofLeaves(proof);
  const target = leaves.find(
    (p) =>
      p.height === part.height &&
      p.offset === part.offset &&
      p.hash === part.hash,
  );
  if (!target) return false;
  if (target.txid || target.duplicate) return true;

  const childLevel = target.height - 1;
  if (childLevel < 0) return true;

  const left = leaves.find(
    (p) => p.height === childLevel && p.offset === target.offset * 2,
  );
  const right = leaves.find(
    (p) => p.height === childLevel && p.offset === target.offset * 2 + 1,
  );
  return !(left?.hash && right?.hash);
}

// --- Components ---

export const MerkleTreeView = () => {
  const { tree } = useMerkleTree();
  return (
    <figure>
      <ul className="tree">
        <MerkleRoot key={tree.hash} tree={tree} />
      </ul>
    </figure>
  );
};

const MerkleRoot: FC<{ tree: MerkleTree }> = ({ tree }) => (
  <li title={`Hash: ${tree.hash}\ntree height: ${tree.height - 1}`}>
    <code>Merkle Root</code>
    <Branches left={tree.left} right={tree.right} />
  </li>
);

function isLeaf(part: TreePart): part is TreeLeaf | DuplicatedNode {
  return !("left" in part && "right" in part);
}

const Branches: FC<{
  left: TreePart;
  right: TreePart;
  onSelectionChange?: (selected: boolean, hash: string) => void;
}> = ({ left, right, onSelectionChange = () => {} }) => {
  const { add } = useMerklePath();

  const leftHandler = (selected: boolean, hash: string) => {
    if (selected) add(hash, right);
    onSelectionChange(selected, hash);
  };

  const rightHandler = (selected: boolean, hash: string) => {
    if (selected) add(hash, left);
    onSelectionChange(selected, hash);
  };

  return (
    <ul>
      {isLeaf(left) ? (
        <MerkleTreeLeaf part={left} onSelectionChange={leftHandler} />
      ) : (
        <MerkleNode part={left} onSelectionChange={leftHandler} />
      )}
      {isLeaf(right) ? (
        <MerkleTreeLeaf part={right} onSelectionChange={rightHandler} />
      ) : (
        <MerkleNode part={right} onSelectionChange={rightHandler} />
      )}
    </ul>
  );
};

const MerkleNode: FC<{
  part: TreeNode;
  onSelectionChange?: (selected: boolean, hash: string) => void;
}> = ({ part, onSelectionChange = () => {} }) => {
  const { proof } = useMerklePath();
  const inPath = isInProofPath(part, proof);
  const required = inPath && isRequiredForBump(part, proof);

  return (
    <MerkleTreePart
      part={part}
      className={`${required ? "merkleproof" : ""} ${
        inPath && !required ? "calculable" : ""
      }`}
    >
      <Branches
        left={part.left}
        right={part.right}
        onSelectionChange={onSelectionChange}
      />
    </MerkleTreePart>
  );
};

const MerkleTreeLeaf: FC<{
  part: TreeLeaf | DuplicatedNode;
  onSelectionChange?: (selected: boolean, hash: string) => void;
}> = ({ part, onSelectionChange = () => {} }) => {
  const merkleProof = useMerklePath();
  const { proof } = merkleProof;
  const selected = !part.duplicated && part.hash in proof;
  const inPath = isInProofPath(part, proof);
  const required = inPath && isRequiredForBump(part, proof);

  const clickHandler = () => {
    if (part.duplicated) return;
    if (selected) {
      merkleProof.remove(part.hash);
      onSelectionChange(false, part.hash);
    } else {
      merkleProof.add(part.hash, part);
      onSelectionChange(true, part.hash);
    }
  };

  return (
    <MerkleTreePart
      part={part}
      onClick={clickHandler}
      className={`${!part.duplicated ? "clickable" : ""} ${
        selected ? "selected" : ""
      } ${required ? "merkleproof" : ""} ${
        inPath && !required ? "calculable" : ""
      }`}
    />
  );
};

const MerkleTreePart: FC<
  PropsWithChildren<{
    part: TreePart;
    onClick?: () => void;
    className?: string;
  }>
> = ({ part, onClick = () => {}, className = "", children }) => (
  <li
    title={`${part.hash}\nheight: ${part.height} offset: ${part.offset}`}
    onClick={onClick}
    className={className}
  >
    <code>
      {part.offset}: {part.duplicated ? "*" : part.hash.slice(0, 4)}
    </code>
    {children}
  </li>
);
