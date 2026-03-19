import { useMerklePath } from "./MerkleProofsProvider.tsx";
import _ from "lodash";
import { NoTransactionSelected } from "./NoTransactionSelected.tsx";
import "./BsvUnifiedMerklePathView.css";
import { displayAsIfItWereA32ByteHash } from "./RenderHashes.tsx";
import { MerklePath } from "@bsv/sdk";
import { useBlockData } from "./BlockDataProvider.tsx";

// Build a single-level compound MerklePath containing every txid in the block.
// MerklePath.extract() can then derive any sub-proof from this via findOrComputeLeaf.
function buildFullBlockPath(txids: string[], blockHeight: number): MerklePath {
  const level0 = txids.map((txid, idx) => ({ offset: idx, hash: txid, txid: true }));
  if (level0.length % 2 === 1) {
    (level0 as Array<{ offset: number; hash?: string; txid?: boolean; duplicate?: boolean }>)
      .push({ offset: level0.length, duplicate: true });
  }
  return new MerklePath(blockHeight, [level0]);
}

// --- Component ---

export const BsvUnifiedMerklePathView = () => {
  const { proof } = useMerklePath();
  const { blockData } = useBlockData();
  const blockHeight = blockData?.height ?? 0;

  if (_.isEmpty(proof) || !blockData?.txids) {
    return (
      <div className="bump-comparison">
        <div className="bump-comparison__empty">
          <NoTransactionSelected />
        </div>
      </div>
    );
  }

  const txHashes = Object.keys(proof);

  // Single-level full block path — all txids; SDK computes intermediate nodes on demand
  const fullBlockPath = buildFullBlockPath(blockData.txids, blockHeight);

  // Individual BUMPs: use MerklePath.extract() to get a minimal proof per txid
  const knownHashes = txHashes.filter((h) => blockData.txids.includes(h));
  const individualItems = knownHashes.map((hash) => {
    try {
      const mp = fullBlockPath.extract([hash]);
      return { hash, hex: mp.toHex(), bytes: mp.toBinary().length };
    } catch {
      return { hash, hex: '(error)', bytes: 0 };
    }
  });
  const individualTotalBytes = individualItems.reduce((sum, { bytes }) => sum + bytes, 0);

  // Compound BUMP: single extract() call for all selected txids
  let compoundHex = '';
  let compoundBytes = 0;
  try {
    const compound = fullBlockPath.extract(knownHashes);
    compoundHex = compound.toHex();
    compoundBytes = compound.toBinary().length;
  } catch (e) {
    compoundHex = `(error: ${e instanceof Error ? e.message : String(e)})`;
  }

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
