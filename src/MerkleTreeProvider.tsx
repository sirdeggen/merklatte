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
  // mp.path is level-indexed: path[0] = leaves, path[1] = next level up, ...
  // Each level is a sparse array of { offset, hash?, txid?, duplicate? }
  //
  // In a Merkle proof the BUMP stores:
  //   - Level 0: the txid leaf(s) plus any sibling leaves
  //   - Level N (N>0): sibling hashes needed at that tree height
  //
  // Strategy: maintain a working map of "known nodes" keyed by (height, offset).
  // Start with level-0 leaves.  Then for each subsequent BUMP level we:
  //   1. Add the explicit sibling entry as an opaque node (DuplicatedNode) at
  //      that height.
  //   2. Pair every pair of known nodes at the current height that share the
  //      same parent offset into a TreeNode one height up.
  //   3. Repeat until we've processed all levels.

  const totalLevels = mp.path.length;

  // knownNodes[height] = Map<offset, TreePart>
  const knownNodes: Map<number, TreePart>[] = [];

  // Seed height 0 — leaves from BUMP level 0
  const leafMap = new Map<number, TreePart>();
  for (const leaf of mp.path[0] ?? []) {
    leafMap.set(leaf.offset, {
      height: 0,
      hash: leaf.hash ?? "",
      offset: leaf.offset,
      ...(leaf.duplicate ? { duplicated: true as const } : {}),
    } as TreeLeaf);
  }
  knownNodes[0] = leafMap;

  // Helper: starting at a given height, pair any sibling nodes into parents
  // and keep going up as long as new pairs are formed.
  function pairUpward(startHeight: number) {
    let h = startHeight;
    while (true) {
      const currentHeight = knownNodes[h];
      if (!currentHeight || currentHeight.size === 0) break;

      const nextHeight = h + 1;
      if (!knownNodes[nextHeight]) knownNodes[nextHeight] = new Map();

      let paired = false;
      for (const offset of [...currentHeight.keys()]) {
        const siblingOffset = offset % 2 === 0 ? offset + 1 : offset - 1;
        if (!currentHeight.has(siblingOffset)) continue;

        const parentOffset = Math.floor(offset / 2);
        if (knownNodes[nextHeight].has(parentOffset)) continue;

        const leftOffset = parentOffset * 2;
        const rightOffset = parentOffset * 2 + 1;
        const left = currentHeight.get(leftOffset)!;
        const right = currentHeight.get(rightOffset)!;

        knownNodes[nextHeight].set(parentOffset, {
          height: nextHeight,
          hash: left.hash + right.hash,
          offset: parentOffset,
          left,
          right,
        });
        paired = true;
      }
      if (!paired) break;
      h = nextHeight;
    }
  }

  // First, pair anything already possible at level 0 (e.g. two sibling txid leaves)
  pairUpward(0);

  // Process each BUMP level 1..N.
  // Add the explicit sibling entry, then pair from that height upward.
  for (let lvl = 1; lvl < totalLevels; lvl++) {
    if (!knownNodes[lvl]) knownNodes[lvl] = new Map();
    const heightMap = knownNodes[lvl];

    for (const entry of mp.path[lvl] ?? []) {
      if (!heightMap.has(entry.offset)) {
        heightMap.set(entry.offset, {
          height: lvl,
          hash: entry.hash ?? "",
          offset: entry.offset,
          duplicated: true as const,
        } as DuplicatedNode);
      }
    }

    // After adding the sibling, try to pair from this height upward
    pairUpward(lvl);
  }

  // The root is at the highest level with a node at offset 0
  for (let h = knownNodes.length - 1; h >= 0; h--) {
    const level = knownNodes[h];
    if (!level) continue;
    const root =
      level.get(0) ??
      (level.size === 1 ? level.values().next().value : undefined);
    if (root && "left" in root) return root as MerkleTree;
  }

  // Fallback — if the BUMP only has one level (single tx block), wrap it
  const singleLeaf = knownNodes[0]?.values().next().value;
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
