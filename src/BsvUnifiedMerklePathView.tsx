import { useMerklePath } from "./MerkleProofsProvider.tsx";
import _ from "lodash";
import { NoTransactionSelected } from "./NoTransactionSelected.tsx";
import "./BsvUnifiedMerklePathView.css";
import { MerkleProofByTx } from "./merkle-tree-data";
import { displayAsIfItWereA32ByteHash } from "./RenderHashes.tsx";
import { MerklePath } from "@bsv/sdk";
import { useBlockData } from "./BlockDataProvider.tsx";

// --- Types ---

interface PathLeaf {
  offset: number;
  hash?: string;
  txid?: boolean;
  duplicate?: boolean;
}

type BumpPath = PathLeaf[][];

// --- Build SDK MerklePath for a single txid ---
// (works because single-txid paths don't trigger the root comparison)

function buildIndividualMerklePath(
  txHash: string,
  proof: MerkleProofByTx,
  blockHeight: number,
): MerklePath {
  const entry = proof[txHash];
  
  // Group nodes by height
  const byHeight = new Map<number, PathLeaf[]>();
  
  // Add txid at height 0
  byHeight.set(0, [{
    offset: entry.index,
    hash: displayAsIfItWereA32ByteHash(txHash),
    txid: true,
  }]);

  // Add path nodes
  for (const node of entry.path) {
    if (!byHeight.has(node.height)) byHeight.set(node.height, []);
    if (node.duplicated) {
      byHeight.get(node.height)!.push({ offset: node.offset, duplicate: true });
    } else if (node.hash && node.hash.length > 0) {
      byHeight.get(node.height)!.push({
        offset: node.offset,
        hash: displayAsIfItWereA32ByteHash(node.hash),
      });
    }
  }

  // Build sparse array indexed by actual tree height
  // Empty levels are valid when intermediate nodes are calculable
  // Exclude the root level - path should stop at treeHeight-1
  const maxHeight = Math.max(...byHeight.keys());
  
  // Remove root level if it exists (nodes at maxHeight with offset 0)
  // The root is calculable and shouldn't be in the path
  if (byHeight.has(maxHeight)) {
    const rootLevel = byHeight.get(maxHeight)!;
    if (rootLevel.length === 1 && rootLevel[0].offset === 0) {
      byHeight.delete(maxHeight);
    }
  }
  
  const finalMaxHeight = Math.max(...byHeight.keys());
  const path: BumpPath = [];
  for (let h = 0; h <= finalMaxHeight; h++) {
    const leaves = byHeight.get(h) ?? [];
    // Sort leaves by offset
    leaves.sort((a, b) => a.offset - b.offset);
    path[h] = leaves;
  }

  return new MerklePath(blockHeight, path);
}

// --- Build compound path manually (merge + trim) ---
// We can't use MerklePath.combine() because it validates roots via SHA256,
// which our demo hashes (fake concatenations) can't satisfy.

function buildCompoundPath(proof: MerkleProofByTx): BumpPath {
  // Collect all leaves from all individual paths
  const allLeaves = new Map<string, PathLeaf>(); // key: "height_offset"

  for (const [txHash, entry] of Object.entries(proof)) {
    const key0 = `0_${entry.index}`;
    allLeaves.set(key0, {
      offset: entry.index,
      hash: displayAsIfItWereA32ByteHash(txHash),
      txid: true,
    });

    for (const node of entry.path) {
      const key = `${node.height}_${node.offset}`;
      if (!allLeaves.has(key)) {
        if (node.duplicated) {
          allLeaves.set(key, {
            offset: node.offset,
            duplicate: true,
          });
        } else if (node.hash && node.hash.length > 0) {
          allLeaves.set(key, {
            offset: node.offset,
            hash: displayAsIfItWereA32ByteHash(node.hash),
          });
        }
      }
    }
  }

  // Group by height
  const byHeight = new Map<number, PathLeaf[]>();
  for (const [key, leaf] of allLeaves) {
    const height = parseInt(key.split("_")[0]);
    if (!byHeight.has(height)) byHeight.set(height, []);
    byHeight.get(height)!.push(leaf);
  }

  // Trim: remove non-txid, non-duplicate nodes whose both children are present
  const txidOffsets = new Set(
    Object.values(proof).map((e) => `0_${e.index}`)
  );

  for (const [height, leaves] of byHeight) {
    if (height === 0) continue;
    const below = byHeight.get(height - 1);
    if (!below) continue;
    const belowOffsets = new Set(below.map((l) => l.offset));

    byHeight.set(
      height,
      leaves.filter((leaf) => {
        if (leaf.duplicate) return true;
        if (txidOffsets.has(`${height}_${leaf.offset}`)) return true;
        const leftChild = leaf.offset * 2;
        const rightChild = leaf.offset * 2 + 1;
        const bothChildrenPresent =
          belowOffsets.has(leftChild) && belowOffsets.has(rightChild);
        return !bothChildrenPresent;
      }),
    );
  }

  // Build sparse array indexed by actual tree height
  // Empty levels are valid when intermediate nodes are calculable
  // Exclude the root level - path should stop at treeHeight-1
  const maxHeight = Math.max(...byHeight.keys());
  
  // Remove root level if it exists (nodes at maxHeight with offset 0)
  // The root is calculable and shouldn't be in the path
  if (byHeight.has(maxHeight)) {
    const rootLevel = byHeight.get(maxHeight)!;
    if (rootLevel.length === 1 && rootLevel[0].offset === 0) {
      byHeight.delete(maxHeight);
    }
  }
  
  const finalMaxHeight = Math.max(...byHeight.keys());
  const path: BumpPath = [];
  for (let h = 0; h <= finalMaxHeight; h++) {
    const leaves = byHeight.get(h) ?? [];
    // Sort leaves by offset
    leaves.sort((a, b) => a.offset - b.offset);
    path[h] = leaves;
  }

  return path;
}

// --- Build compound MerklePath using SDK ---

function buildCompoundMerklePath(path: BumpPath, blockHeight = 0): MerklePath {
  return new MerklePath(blockHeight, path);
}

// --- Component ---

export const BsvUnifiedMerklePathView = () => {
  const { proof } = useMerklePath();
  const { blockData } = useBlockData();
  const blockHeight = blockData?.height ?? 0;

  if (_.isEmpty(proof)) {
    return (
      <div className="bump-comparison">
        <div className="bump-comparison__empty">
          <NoTransactionSelected />
        </div>
      </div>
    );
  }

  const txHashes = Object.keys(proof);

  // Individual BUMPs via SDK (single-txid paths are valid)
  const individualItems = txHashes.map((hash) => {
    const mp = buildIndividualMerklePath(hash, proof, blockHeight);
    return { hash, hex: mp.toHex(), bytes: mp.toBinary().length };
  });
  const individualTotalBytes = individualItems.reduce(
    (sum, { bytes }) => sum + bytes,
    0,
  );

  // Compound BUMP via SDK MerklePath.toHex()
  const compoundPath = buildCompoundPath(proof);
  const compoundMerklePath = buildCompoundMerklePath(compoundPath, blockHeight);
  const compoundHex = compoundMerklePath.toHex();
  const compoundBytes = compoundHex.length / 2;

  const savings = individualTotalBytes - compoundBytes;
  const pct =
    individualTotalBytes > 0
      ? Math.round((savings / individualTotalBytes) * 100)
      : 0;

  return (
    <div className="bump-comparison">
      <div className="bump-comparison__stats">
        <div className="bump-stat">
          <span className="bump-stat__label">Individual BUMPs</span>
          <span className="bump-stat__value bump-stat__value--individual">
            {individualTotalBytes} bytes
          </span>
          <span className="bump-stat__detail">
            {txHashes.length} proof{txHashes.length !== 1 ? "s" : ""} &times;
            avg {Math.round(individualTotalBytes / txHashes.length)} B
          </span>
        </div>
        <div className="bump-stat">
          <span className="bump-stat__label">Compound BUMP</span>
          <span className="bump-stat__value bump-stat__value--compound">
            {compoundBytes} bytes
          </span>
          <span className="bump-stat__detail">single proof, all txids</span>
        </div>
        {savings > 0 && (
          <div className="bump-stat bump-stat--savings">
            <span className="bump-stat__label">Savings</span>
            <span className="bump-stat__value bump-stat__value--savings">
              {savings} bytes ({pct}%)
            </span>
          </div>
        )}
      </div>

      <div className="bump-comparison__panels">
        <div className="bump-panel">
          <h3 className="bump-panel__title">
            Individual BUMPs
            <span className="bump-panel__subtitle">
              One proof per transaction
            </span>
          </h3>
          <div className="bump-panel__scroll">
            {individualItems.map(({ hash, hex, bytes }) => (
              <div key={hash} className="bump-panel__block">
                <div className="bump-panel__block-label">
                  tx: {displayAsIfItWereA32ByteHash(hash).slice(0, 16)}...
                  <span className="bump-panel__block-size">{bytes} B</span>
                </div>
                <pre className="bump-panel__code">{hex}</pre>
              </div>
            ))}
          </div>
        </div>

        <div className="bump-panel bump-panel--compound">
          <h3 className="bump-panel__title">
            Compound BUMP
            <span className="bump-panel__subtitle">
              All transactions in one proof
            </span>
          </h3>
          <div className="bump-panel__scroll">
            <pre className="bump-panel__code">{compoundHex}</pre>
          </div>
        </div>
      </div>

      <p className="bump-comparison__note">
        Compound BUMPs eliminate duplicate intermediate hashes shared between
        individual proofs, reducing total proof size while preserving full
        verification capability.
      </p>
    </div>
  );
};
