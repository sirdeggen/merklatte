import "./MerkleTreeView.css";
import { FC, PropsWithChildren, useState } from "react";
import { TreeLeaf, TreeNode, TreePart, MerkleTree, DuplicatedNode, MerkleProofByTx } from "./merkle-tree-data";
import { useMerkleTree } from "./MerkleTreeProvider.tsx";
import * as _ from "lodash";
import { useMerklePath } from "./MerkleProofsProvider.tsx";

// Import optimized BUMP logic to determine which nodes should be highlighted
interface MerklePathLeaf {
  hash: string;
  txid?: boolean;
  duplicate?: boolean;
  offset: number;
  height: number;
}

function isRequiredForOptimizedBump(targetPart: TreePart, proof: MerkleProofByTx): boolean {
  // Convert proof to MerklePathLeaf format for analysis
  const allPaths = listAllPathsFromProof(proof);
  
  const targetPath = allPaths.find(p => 
    p.height === targetPart.height && 
    p.offset === targetPart.offset && 
    p.hash === targetPart.hash
  );
  
  if (!targetPath) return false;
  
  return isRequiredForCalculation(targetPath, allPaths);
}

function listAllPathsFromProof(proof: MerkleProofByTx): MerklePathLeaf[] {
  return Object.entries(proof).flatMap((it) => [
    {
      hash: it[0],
      txid: true,
      offset: it[1].index,
      height: 0,
    },
    ...it[1].path.map((p) => ({
      hash: p.hash,
      offset: p.offset,
      height: p.height,
      duplicate: p.duplicated,
    })),
  ]);
}

function isRequiredForCalculation(targetPath: MerklePathLeaf, allPaths: MerklePathLeaf[]): boolean {
  // If this is a txid node, it's always required
  if (targetPath.txid) return true;
  
  // If this is a duplicate, it's required
  if (targetPath.duplicate) return true;
  
  // Check if both children exist at the level below
  const childLevel = targetPath.height - 1;
  if (childLevel < 0) return true; // Base level
  
  const leftChildOffset = targetPath.offset * 2;
  const rightChildOffset = targetPath.offset * 2 + 1;
  
  const leftChild = allPaths.find(p => p.height === childLevel && p.offset === leftChildOffset);
  const rightChild = allPaths.find(p => p.height === childLevel && p.offset === rightChildOffset);
  
  // If both children are present and have hashes, this parent node is calculable (not required)
  if (leftChild && rightChild && leftChild.hash && rightChild.hash) {
    return false; // This node can be calculated from its children
  }
  
  // Otherwise, this node is required
  return true;
}

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

interface MerkleRootProps {
  tree: MerkleTree;
}
const MerkleRoot: FC<MerkleRootProps> = ({ tree }) => {
  return (
    <li
      title={`Hash: ${tree.hash}
 tree height: ${tree.height - 1}`}
    >
      <code>Merkle Root</code>
      <Branches left={tree.left} right={tree.right} />
    </li>
  );
};

interface BaseNodeProps {
  isPartOfMerkleProof?: boolean;
  onSelectionChange?: (selected: boolean, hash: string) => void;
}

interface MerkleNodeProps extends BaseNodeProps {
  part: TreeNode ;
}

const MerkleNode: FC<MerkleNodeProps> = ({
  part,
  isPartOfMerkleProof = false,
  onSelectionChange = () => {},
}) => {
  const { proof } = useMerklePath();
  const shouldHighlight = isPartOfMerkleProof && isRequiredForOptimizedBump(part, proof);
  
  return (
    <MerkleTreePart
      part={part}
      className={`${shouldHighlight ? "merkleproof" : ""} ${isPartOfMerkleProof && !shouldHighlight ? "calculable" : ""}`}
    >
      <Branches
        left={part.left}
        right={part.right}
        onSelectionChange={onSelectionChange}
      />
    </MerkleTreePart>
  );
};

function isLeaf(part: TreePart): part is TreeLeaf | DuplicatedNode {
  return !("left" in part && "right" in part);
}

interface BranchesProps {
  left: TreePart;
  right: TreePart;
  onSelectionChange?: (selected: boolean, hash: string) => void;
}

interface MerkleTreePartState {
  left: string[];
  right: string[];
}

const Branches: FC<BranchesProps> = ({
  left,
  right,
  onSelectionChange = () => {},
}) => {
  const [merkleTreePart, setMerkleTreePart] = useState<MerkleTreePartState>({
    left: [],
    right: [],
  });
  const { add: addToMerkleProofs } = useMerklePath();
  const leftSelectionHandler = (selected: boolean, hash: string) => {
    const val = {
      left: [...merkleTreePart.left],
      right: [...merkleTreePart.right],
    };
    if (selected) {
      val.right.push(hash);
      addToMerkleProofs(hash, right);
    } else {
      val.right = val.right.filter((it) => it !== hash);
    }
    setMerkleTreePart(val);
    onSelectionChange(selected, hash);
  };

  const rightSelectionHandler = (selected: boolean, hash: string) => {
    const val = {
      left: [...merkleTreePart.left],
      right: [...merkleTreePart.right],
    };
    if (selected) {
      val.left.push(hash);
      addToMerkleProofs(hash, left);
    } else {
      val.left = val.left.filter((it) => it !== hash);
    }
    setMerkleTreePart(val);
    onSelectionChange(selected, hash);
  };

  return (
    <ul>
      {isLeaf(left) ? (
        <MerkleTreeLeaf
          part={left}
          isPartOfMerkleProof={!_.isEmpty(merkleTreePart.left)}
          onSelectionChange={leftSelectionHandler}
        />
      ) : (
        <MerkleNode
          part={left}
          isPartOfMerkleProof={!_.isEmpty(merkleTreePart.left)}
          onSelectionChange={leftSelectionHandler}
        />
      )}
      {isLeaf(right) ? (
        <MerkleTreeLeaf
          part={right}
          isPartOfMerkleProof={!_.isEmpty(merkleTreePart.right)}
          onSelectionChange={rightSelectionHandler}
        />
      ) : (
        <MerkleNode
          part={right}
          isPartOfMerkleProof={!_.isEmpty(merkleTreePart.right)}
          onSelectionChange={rightSelectionHandler}
        />
      )}
    </ul>
  );
};

interface MerkleTreeLeafProps extends BaseNodeProps {
  part: TreeLeaf | DuplicatedNode;
}

const MerkleTreeLeaf: FC<MerkleTreeLeafProps> = ({
  part,
  isPartOfMerkleProof = false,
  onSelectionChange = () => {},
}) => {
  const [selected, setSelected] = useState(false);
  const merkleProof = useMerklePath();
  const shouldHighlight = isPartOfMerkleProof && isRequiredForOptimizedBump(part, merkleProof.proof);

  const clickHandler = () => {
    if (part.duplicated) {
      return;
    }

    const val = !selected;
    setSelected(val);
    if (val) {
      merkleProof.add(part.hash, part);
    } else {
      merkleProof.remove(part.hash);
    }
    onSelectionChange(val, part.hash);
  };

  return (
    <MerkleTreePart
      part={part}
      onClick={clickHandler}
      className={`${!part.duplicated && "clickable"} ${
        selected && "selected"
      } ${shouldHighlight && "merkleproof"} ${isPartOfMerkleProof && !shouldHighlight ? "calculable" : ""}`}
    />
  );
};

interface MerkleTreePartProps {
  part: TreePart;
  onClick?: () => void;
  className?: string;
}

const MerkleTreePart: FC<PropsWithChildren<MerkleTreePartProps>> = ({
  part,
  onClick = () => {},
  className = "",
  children,
}) => {
  return (
    <li
      title={`height: ${part.height} offset: ${part.offset}`}
      onClick={onClick}
      className={className}
    >
      <code>
        {part.offset}: {part.duplicated ? "*" : part.hash}
      </code>
      {children}
    </li>
  );
};
