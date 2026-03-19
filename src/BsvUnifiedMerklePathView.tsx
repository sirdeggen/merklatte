import { useMerklePath } from "./MerkleProofsProvider.tsx";
import { NoTransactionSelected } from "./NoTransactionSelected.tsx";
import "./BsvUnifiedMerklePathView.css";
import { useBlockData } from "./BlockDataProvider.tsx";
import { useState, useEffect } from "react";
import { CircularProgress } from "@mui/material";
import { ByteSize } from "./ByteSize.tsx";

interface GroupResult {
  txCount: number;
  bytes: number;
  hex: string;
}

interface ComputedResults {
  groups: GroupResult[];
  totalBumpBytes: number;
  fullTreeTotalBytes: number; // groups.length × full tree
  sampleIndividualHex: string;
  sampleIndividualBytes: number;
  totalIndividualBytes: number; // all txids × sampleIndividualBytes
}

// --- Component ---

export const BsvUnifiedMerklePathView = () => {
  const { partitions } = useMerklePath();
  const { blockData, fullBlockPath } = useBlockData();
  const [computing, setComputing] = useState(false);
  const [results, setResults] = useState<ComputedResults | null>(null);

  useEffect(() => {
    if (!partitions || !fullBlockPath || !blockData?.txids) {
      setResults(null);
      setComputing(false);
      return;
    }

    setComputing(true);
    setResults(null);

    const id = setTimeout(() => {
      const groups: GroupResult[] = partitions.map((group) => {
        const known = group.filter((h) => blockData.txids.includes(h));
        try {
          const mp = fullBlockPath.extract(known);
          return { txCount: known.length, bytes: mp.toBinary().length, hex: mp.toHex() };
        } catch (e) {
          return { txCount: known.length, bytes: 0, hex: `(error: ${e instanceof Error ? e.message : String(e)})` };
        }
      });

      let sampleIndividualHex = '';
      let sampleIndividualBytes = 0;
      const firstKnown = partitions.flat().find((h) => blockData.txids.includes(h));
      if (firstKnown) {
        try {
          const mp = fullBlockPath.extract([firstKnown]);
          sampleIndividualHex = mp.toHex();
          sampleIndividualBytes = mp.toBinary().length;
        } catch { /* leave as empty */ }
      }

      const totalBumpBytes = groups.reduce((s, g) => s + g.bytes, 0);
      const fullTreeTotalBytes = groups.length * blockData.txids.length * 32;
      const totalIndividualBytes = sampleIndividualBytes * blockData.txids.length;

      setResults({ groups, totalBumpBytes, fullTreeTotalBytes, sampleIndividualHex, sampleIndividualBytes, totalIndividualBytes });
      setComputing(false);
    }, 0);

    return () => clearTimeout(id);
  }, [partitions, fullBlockPath]);

  if (!partitions || !blockData?.txids) {
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

  const { groups, totalBumpBytes, fullTreeTotalBytes, sampleIndividualHex, sampleIndividualBytes, totalIndividualBytes } = results;
  const savedVsIndividual = totalIndividualBytes - totalBumpBytes;
  const savedVsIndividualPct = totalIndividualBytes > 0 ? Math.round((savedVsIndividual / totalIndividualBytes) * 100) : 0;
  const savedVsFullTree = fullTreeTotalBytes - totalBumpBytes;
  const savedVsFullTreePct = fullTreeTotalBytes > 0 ? Math.round((savedVsFullTree / fullTreeTotalBytes) * 100) : 0;
  const exampleGroup = groups[0];

  return (
    <div className="bump-comparison">
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
        {savedVsIndividual > 0 && (
          <div className="bump-stat bump-stat--savings">
            <span className="bump-stat__label">Saved</span>
            <span className="bump-stat__value bump-stat__value--savings">{savedVsIndividualPct}%</span>
            <span className="bump-stat__detail">vs individual BUMPs</span>
            <span className="bump-stat__value bump-stat__value--savings">{savedVsFullTreePct}%</span>
            <span className="bump-stat__detail">vs full tree</span>
          </div>
        )}
      </div>

      {savedVsIndividual > 0 && (
        <p className="bump-comparison__insight">
          {groups.length} businesses sharing a block each need only their own compound BUMP —
          saving <strong>{savedVsIndividualPct}%</strong> over individual per-transaction proofs
          and <strong>{savedVsFullTreePct}%</strong> over transmitting the full transaction list.
        </p>
      )}

      <div className="bump-comparison__panels">
        <div className="bump-panel">
          <h3 className="bump-panel__title">
            Individual BUMP
            <span className="bump-panel__subtitle">example — one proof per tx</span>
          </h3>
          <div className="bump-panel__scroll">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', padding: '0.35rem 0.6rem 0', color: '#71717a', fontSize: '0.75rem' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f472b6', fontVariantNumeric: 'tabular-nums' }}>{blockData.txids.length}</span>
              <span>× proofs of this size across the full block</span>
            </div>
            <div className="bump-panel__block">
              <div className="bump-panel__block-label">
                example tx proof
                <span className="bump-panel__block-size"><ByteSize bytes={sampleIndividualBytes} /></span>
              </div>
              <pre className="bump-panel__code">{sampleIndividualHex}</pre>
            </div>
          </div>
        </div>

        <div className="bump-panel bump-panel--compound">
          <h3 className="bump-panel__title">
            Example: Business 1 Compound BUMP
            <span className="bump-panel__subtitle">
              {exampleGroup.txCount} txids — <ByteSize bytes={exampleGroup.bytes} />
            </span>
          </h3>
          <div className="bump-panel__scroll">
            <pre className="bump-panel__code">{exampleGroup.hex}</pre>
          </div>
        </div>
      </div>

      <p className="bump-comparison__note">
        Each business receives a single compound BUMP covering only their transactions.
        Shared intermediate hashes are included once, not repeated per transaction.
      </p>
    </div>
  );
};
