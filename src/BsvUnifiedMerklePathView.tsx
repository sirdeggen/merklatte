import { useMerklePath } from "./MerkleProofsProvider.tsx";
import { NoTransactionSelected } from "./NoTransactionSelected.tsx";
import "./BsvUnifiedMerklePathView.css";
import { useBlockData } from "./BlockDataProvider.tsx";
import { useState, useEffect } from "react";
import { CircularProgress } from "@mui/material";
import { ByteSize } from "./ByteSize.tsx";
import { MerklePath } from '@bsv/sdk';

interface GroupResult {
  txCount: number;
  bytes: number;
  hex: string;
}

interface ComputedResults {
  groups: GroupResult[];
  totalBumpBytes: number;
  fullTreeTotalBytes: number; // groups.length × full tree
  fullBlockBumpBytes: number; // single compound BUMP for all txids
  sampleIndividualHex: string;
  sampleIndividualBytes: number;
  totalIndividualBytes: number; // all txids × sampleIndividualBytes
}

function computeGroupResult(group: string[], knownTxids: string[], blockPath: MerklePath): GroupResult {
  const known = group.filter((h) => knownTxids.includes(h));
  try {
    const mp = blockPath.extract(known);
    return { txCount: known.length, bytes: mp.toBinary().length, hex: mp.toHex() };
  } catch (e) {
    return { txCount: known.length, bytes: 0, hex: `(error: ${e instanceof Error ? e.message : String(e)})` };
  }
}

function computeResults(
  proofKeys: string[],
  txids: string[],
  partitions: string[][] | null,
  blockPath: MerklePath,
): ComputedResults {
  const biz1Txids = proofKeys
    .filter((h) => txids.includes(h))
    .sort((a, b) => txids.indexOf(a) - txids.indexOf(b));

  const otherPartitions = partitions ? partitions.slice(1) : [];
  const allRawGroups = [biz1Txids, ...otherPartitions];
  const groups = allRawGroups.map((g) => computeGroupResult(g, txids, blockPath));
  console.log({ groups })

  let sampleIndividualHex = '';
  let sampleIndividualBytes = 0;
  const lowestOffsetTx = biz1Txids[0];
  if (lowestOffsetTx) {
    try {
      const mp = blockPath.extract([lowestOffsetTx]);
      sampleIndividualHex = mp.toHex();
      sampleIndividualBytes = mp.toBinary().length;
    } catch { /* leave as empty */ }
  }

  const totalBumpBytes = groups.reduce((s, g) => s + g.bytes, 0);
  const fullTreeTotalBytes = groups.length * txids.length * 32;
  const totalIndividualBytes = sampleIndividualBytes * txids.length;
  const fullBlockBumpBytes = blockPath.toBinary().length;

  return { groups, totalBumpBytes, fullTreeTotalBytes, fullBlockBumpBytes, sampleIndividualHex, sampleIndividualBytes, totalIndividualBytes };
}

// --- Component ---

export const BsvUnifiedMerklePathView = () => {
  const { partitions, proof } = useMerklePath();
  const { blockData, fullBlockPath } = useBlockData();
  const proofKeys = Object.keys(proof);
  const [computing, setComputing] = useState(false);
  const [results, setResults] = useState<ComputedResults | null>(null);

  useEffect(() => {
    const hasBiz1 = proofKeys.length > 0;
    if (!hasBiz1 || !fullBlockPath || !blockData?.txids) {
      setResults(null);
      setComputing(false);
      return;
    }

    setComputing(true);
    setResults(null);

    const id = setTimeout(() => {
      setResults(computeResults(proofKeys, blockData.txids, partitions, fullBlockPath));
      setComputing(false);
    }, 0);

    return () => clearTimeout(id);
  }, [proofKeys.join(','), partitions, fullBlockPath]);

  if (proofKeys.length === 0 || !blockData?.txids) {
    return (
      <div className="bump-comparison">
        <div className="bump-comparison__empty">
          <NoTransactionSelected />
        </div>
      </div>
    );
  }

  if (computing || !results) {
    return (
      <div className="bump-comparison">
        <div className="bump-comparison__empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <CircularProgress size={28} sx={{ color: '#6ee7b7' }} />
          <span style={{ fontSize: '0.8rem', color: '#52525b' }}>Computing Merkle paths…</span>
        </div>
      </div>
    );
  }

  const rawDataSize = (blockData?.txids.length || 0) * 32 * (results.groups.length || 1);
  const { groups, totalBumpBytes, fullTreeTotalBytes, fullBlockBumpBytes, sampleIndividualHex, sampleIndividualBytes, totalIndividualBytes } = results;
  const savedVsIndividual = totalIndividualBytes - totalBumpBytes;
  const savedVsIndividualPct = totalIndividualBytes > 0 ? Math.round((savedVsIndividual / totalIndividualBytes) * 100) : 0;
  const savedVsFullTree = rawDataSize - totalBumpBytes;
  const savedVsFullTreePct = fullTreeTotalBytes > 0 ? Math.round((savedVsFullTree / rawDataSize) * 100) : 0;
  const exampleGroup = groups[0];

  return (
    <div className="bump-comparison">
      {savedVsIndividual > 0 && (
        <div className="bump-comparison__savings-hero">
          <span className="bump-savings-hero__label">Saved</span>
          <div className="bump-savings-hero__numbers">
            <div className="bump-savings-hero__figure">
              <span className="bump-savings-hero__pct">{savedVsIndividualPct}%</span>
              <span className="bump-savings-hero__vs">vs individual BUMPs</span>
            </div>
            <div className="bump-savings-hero__divider" />
            <div className="bump-savings-hero__figure">
              <span className="bump-savings-hero__pct">{savedVsFullTreePct}%</span>
              <span className="bump-savings-hero__vs">vs full tree each business</span>
            </div>
          </div>
        </div>
      )}

      <div className="bump-comparison__stats">
        <div className="bump-stat">
          <span className="bump-stat__label">{groups.length}× Full Tree</span>
          <span className="bump-stat__value" style={{ color: '#818cf8' }}><ByteSize bytes={fullTreeTotalBytes} /></span>
          <span className="bump-stat__detail">{groups.length} × {blockData.txids.length} txids × 32 B</span>
        </div>
        <div className="bump-stat">
          <span className="bump-stat__label">Individual BUMPs</span>
          <span className="bump-stat__value bump-stat__value--individual"><ByteSize bytes={totalIndividualBytes} /></span>
          <span className="bump-stat__detail">{blockData.txids.length} × <ByteSize bytes={sampleIndividualBytes} /></span>
        </div>
        <div className="bump-stat">
          <span className="bump-stat__label">{groups.length} Compound BUMPs</span>
          <span className="bump-stat__value bump-stat__value--compound"><ByteSize bytes={totalBumpBytes} /></span>
          <span className="bump-stat__detail">1 proof per business</span>
        </div>
        <div className="bump-stat">
          <span className="bump-stat__label">Full Block BUMP</span>
          <span className="bump-stat__value" style={{ color: '#34d399' }}><ByteSize bytes={fullBlockBumpBytes} /></span>
          <span className="bump-stat__detail">{blockData.txids.length} txids, 1 universal proof</span>
        </div>
        {blockData.size != null && (
          <div className="bump-stat">
            <span className="bump-stat__label">Raw Block Data</span>
            <span className="bump-stat__value" style={{ color: '#94a3b8' }}><ByteSize bytes={blockData.size} /></span>
            <span className="bump-stat__detail">full transaction data</span>
          </div>
        )}
      </div>

      <div className="bump-comparison__panels">
        <div className="bump-panel">
          <h3 className="bump-panel__title">
            Individual BUMP <span className="bump-panel__subtitle">example — one proof per tx</span>
          </h3>
          <div className="bump-panel__scroll">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', padding: '0.35rem 0.6rem 0', color: '#71717a', fontSize: '0.75rem' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f472b6', fontVariantNumeric: 'tabular-nums' }}>{blockData.txids.length}</span>
              <span>× proofs of this size across the full block</span>
            </div>
            <div className="bump-panel__block">
              <div className="bump-panel__block-label">
                example tx proof <span className="bump-panel__block-size"><ByteSize bytes={sampleIndividualBytes} /></span>
              </div>
              <pre className="bump-panel__code">{sampleIndividualHex}</pre>
            </div>
          </div>
        </div>

        <div className="bump-panel bump-panel--compound">
          <h3 className="bump-panel__title">
            Example: Business 1 Compound BUMP <span className="bump-panel__subtitle">{exampleGroup.txCount} txids — <ByteSize bytes={exampleGroup.bytes} /></span>
          </h3>
          <div className="bump-panel__scroll">
            <pre className="bump-panel__code">{exampleGroup.hex}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
