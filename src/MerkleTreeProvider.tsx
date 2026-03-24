import {
  FC,
  PropsWithChildren,
  createContext,
  useState,
  useContext,
  useEffect,
} from "react";
import {
  MerkleTree,
  TreeLeaf,
  TreePart,
  DuplicatedNode,
} from "./merkle-tree-data";
import { chunk } from "lodash";
import { useReset } from "./useReset.tsx";
import { MerklePath } from "@bsv/sdk";

interface MerkleTreeDataContextValue {
  tree: MerkleTree;
  setTree: (tree: MerkleTree) => void;
  importedTree: MerkleTree | null;
  setImportedTree: (tree: MerkleTree | null) => void;
  importedMerklePath: MerklePath | null;
  setImportedMerklePath: (mp: MerklePath | null) => void;
}

const MerkleTreeDataContext = createContext<
  MerkleTreeDataContextValue | undefined
>(undefined);
MerkleTreeDataContext.displayName = "MerkleTreeDataContext";

import { useBlockData } from "./BlockDataProvider.tsx";

// ---------------------------------------------------------------------------
// Convert an @bsv/sdk MerklePath into the visual TreeNode / TreeLeaf hierarchy
// ---------------------------------------------------------------------------
export function merklePathToTree(mp: MerklePath): MerkleTree {
  // mp.path is level-indexed: path[0] = leaves, path[1] = next level, ...
  // Each level is a sparse array of { offset, hash?, txid?, duplicate? }

  // Build a map of nodes at each level keyed by offset
  const levels: Map<number, TreePart>[] = [];

  // Level 0 — leaves
  const leafMap = new Map<number, TreePart>();
  for (const leaf of mp.path[0] ?? []) {
    leafMap.set(leaf.offset, {
      height: 0,
      hash: leaf.hash ?? "",
      offset: leaf.offset,
      ...(leaf.duplicate ? { duplicated: true as const } : {}),
    } as TreeLeaf);
  }
  levels[0] = leafMap;

  // Higher levels — build nodes with children from the level below
  const totalLevels = mp.path.length;
  for (let lvl = 1; lvl < totalLevels; lvl++) {
    const nodeMap = new Map<number, TreePart>();
    const pathLevel = mp.path[lvl] ?? [];

    // Gather all offsets we need at this level: explicitly provided + implied by children
    const neededOffsets = new Set<number>();
    for (const node of pathLevel) {
      neededOffsets.add(node.offset);
    }
    // Each child pair at level (lvl-1) with offsets 2n, 2n+1 implies a parent at offset n
    const childLevel = levels[lvl - 1];
    if (childLevel) {
      for (const childOffset of childLevel.keys()) {
        neededOffsets.add(Math.floor(childOffset / 2));
      }
    }

    for (const offset of neededOffsets) {
      const leftChildOffset = offset * 2;
      const rightChildOffset = offset * 2 + 1;

      // Try to get children from the previous level
      let left = childLevel?.get(leftChildOffset);
      let right = childLevel?.get(rightChildOffset);

      // If a child is missing, check if there's an explicit hash at this level
      const explicitNode = pathLevel.find((n) => n.offset === offset);

      if (!left && !right) {
        // No children — this is a provided hash at this level (a proof node).
        // Use DuplicatedNode shape (duplicated: true) so the type system accepts
        // a node with height > 0 that has no children.
        nodeMap.set(offset, {
          height: lvl,
          hash: explicitNode?.hash ?? "",
          offset,
          duplicated: true as const,
        } as DuplicatedNode);
        continue;
      }

      // Create placeholder children if missing
      if (!left) {
        left = {
          height: lvl - 1,
          hash: "",
          offset: leftChildOffset,
        } as TreeLeaf;
      }
      if (!right) {
        right = {
          height: lvl - 1,
          hash: "",
          offset: rightChildOffset,
        } as TreeLeaf;
      }

      // Simplified hash for display (concatenation like the existing code)
      const hash = explicitNode?.hash ?? left.hash + right.hash;

      nodeMap.set(offset, {
        height: lvl,
        hash,
        offset,
        left,
        right,
      });
    }
    levels[lvl] = nodeMap;
  }

  // The root is at the highest level, offset 0
  const rootLevel = levels[totalLevels - 1];
  if (rootLevel && rootLevel.size > 0) {
    const root = rootLevel.get(0) ?? rootLevel.values().next().value;
    if (root && "left" in root) return root as MerkleTree;
  }

  // Fallback — if the BUMP only has one level (single tx block), wrap it
  const singleLeaf = levels[0]?.values().next().value;
  if (singleLeaf) {
    return {
      height: 1,
      hash: singleLeaf.hash,
      offset: 0,
      left: singleLeaf,
      right: { ...singleLeaf, offset: 1, duplicated: true },
    } as MerkleTree;
  }

  return createTreeOfSize(2);
}

export const MerkleTreeProvider: FC<PropsWithChildren> = ({ children }) => {
  const { blockData } = useBlockData();
  const [tree, setTree] = useState<MerkleTree>(createTreeOfSize(2));
  const [importedTree, setImportedTree] = useState<MerkleTree | null>(null);
  const [importedMerklePath, setImportedMerklePath] =
    useState<MerklePath | null>(null);

  useEffect(() => {
    if (blockData?.txids) {
      const leafs = blockData.txids.map(
        (txid, offset) =>
          ({
            hash: txid,
            offset,
            height: 0,
          }) as TreeLeaf,
      );
      let newTree: TreePart[] = [...leafs];
      while (newTree.length > 1) {
        const pairs = chunk(newTree, 2);
        newTree = pairs.map<TreePart>((pair, offset) => {
          const right = pair[1] || {
            hash: pair[0].hash,
            offset: pair[0].offset + 1,
            height: pair[0].height,
            duplicated: true,
          };
          return {
            hash: pair[0].hash + right.hash, // Simplified hash (real would double-sha256)
            offset,
            height: pair[0].height + 1,
            left: pair[0],
            right,
          };
        });
      }
      setTree(newTree[0] as MerkleTree);
    }
  }, [blockData]);

  const value = {
    tree,
    setTree,
    importedTree,
    setImportedTree,
    importedMerklePath,
    setImportedMerklePath,
  };
  return (
    <MerkleTreeDataContext.Provider value={value}>
      {children}
    </MerkleTreeDataContext.Provider>
  );
};

export const useMerkleTree = () => {
  const ctx = useContext(MerkleTreeDataContext);
  if (!ctx) {
    throw new Error("useMerkleTree must be used within MerkleTreeDataContext");
  }

  const { reset } = useReset();
  return {
    tree: ctx.importedTree ?? ctx.tree,
    importedTree: ctx.importedTree,
    importedMerklePath: ctx.importedMerklePath,
    setImportedTree: (tree: MerkleTree | null) => {
      ctx.setImportedTree(tree);
      reset();
    },
    setImportedMerklePath: (mp: MerklePath | null) => {
      ctx.setImportedMerklePath(mp);
    },
    clearImport: () => {
      ctx.setImportedTree(null);
      ctx.setImportedMerklePath(null);
      reset();
    },
    setTreeOfSize: (size: number) => {
      const newTree = createTreeOfSize(size);
      ctx.setTree(newTree);
      reset();
    },
  };
};

const hashes = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "Z0",
  "Z1",
  "Z2",
  "Z3",
  "Z4",
  "Z5",
  "Z6",
  "Z7",
  "Z8",
  "Z9",
];

export function createTreeOfSize(selectedSize: number) {
  const leafs = hashes.slice(0, selectedSize).map(
    (hash, offset) =>
      ({
        hash,
        offset,
        height: 0,
      }) as TreeLeaf,
  );

  let tree: TreePart[] = [...leafs];

  while (tree.length != 1) {
    const pairs = chunk(tree, 2);
    tree = pairs.map<TreePart>((pair, offset) => {
      const right = pair[1] || {
        hash: pair[0].hash,
        offset: pair[0].offset + 1,
        height: pair[0].height,
        duplicated: true,
      };
      return {
        hash: pair[0].hash + right.hash,
        offset,
        height: pair[0].height + 1,
        left: pair[0],
        right: right,
      };
    });
  }

  return tree[0] as MerkleTree;
}
