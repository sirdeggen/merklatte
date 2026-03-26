export type TreePart = TreeNode | TreeLeaf | DuplicatedNode | ProofNode;

export interface TreeLeaf {
  height: 0;
  hash: string;
  offset: number;
  duplicated?: boolean;
}

export interface DuplicatedNode {
  height: number;
  hash: string;
  offset: number;
  duplicated: true;
}

/** An opaque proof-path hash at any tree height (no children, not duplicated). */
export interface ProofNode {
  height: number;
  hash: string;
  offset: number;
  duplicated?: false;
  proof: true;
}

export interface TreeNode {
  height: number;
  hash: string;
  offset: number;
  left: TreePart;
  right: TreePart;
  duplicated?: boolean;
}

export type MerkleTree = TreeNode;

export type CompoundMerkleProof = Record<string, number>[];

export interface MerkleProof {
  index: number;
  path: TreePart[];
}

export type MerkleProofByTx = Record<string, MerkleProof>;
