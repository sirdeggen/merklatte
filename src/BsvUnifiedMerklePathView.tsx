import { useMerklePath } from "./MerkleProofsProvider.tsx";
import _ from "lodash";
import { NoTransactionSelected } from "./NoTransactionSelected.tsx";
import "./BsvUnifiedMerklePathView.css";
import { displayAsIfItWereA32ByteHash } from "./RenderHashes.tsx";
import { useBlockData } from "./BlockDataProvider.tsx";
import { useState, useEffect } from "react";
import { CircularProgress } from "@mui/material";

interface ComputedResults {
  count: number;
  sampleHash: string;
  sampleHex: string;
  sampleBytes: number;
  individualTotalBytes: number;
  compoundHex: string;
  compoundBytes: number;
}

// --- Component ---

export const BsvUnifiedMerklePathView = () => {
  const { proof } = useMerklePath();
  const { blockData, fullBlockPath } = useBlockData();
  const [computing, setComputing] = useState(false);
  const [results, setResults] = useState<ComputedResults | null>(null);

  useEffect(() => {
    if (_.isEmpty(proof) || !fullBlockPath || !blockData?.txids) {
      setResults(null);
      setComputing(false);
      return;
    }

    setComputing(true);
    setResults(null);

    const id = setTimeout(() => {
      const knownHashes = Object.keys(proof).filter((h) =>
        blockData.txids.includes(h),
      );

      let sampleHash = knownHashes[0] ?? '';
      let sampleHex = '';
      let sampleBytes = 0;
      try {
        const mp = fullBlockPath.extract([sampleHash]);
        sampleHex = mp.toHex();
        sampleBytes = mp.toBinary().length;
      } catch {
        sampleHex = '(error)';
      }

      let compoundHex = '';
      let compoundBytes = 0;
      try {
        const compound = fullBlockPath.extract(knownHashes);
        compoundHex = compound.toHex();
        compoundBytes = compound.toBinary().length;
      } catch (e) {
        compoundHex = `(error: ${e instanceof Error ? e.message : String(e)})`;
      }

      setResults({
        count: knownHashes.length,
        sampleHash,
        sampleHex,
        sampleBytes,
        individualTotalBytes: sampleBytes * knownHashes.length,
        compoundHex,
        compoundBytes,
      });
      setComputing(false);
    }, 0);

    return () => clearTimeout(id);
  }, [proof, blockData]);

  if (_.isEmpty(proof) || !blockData?.txids) {
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

  const { count, sampleHash, sampleHex, sampleBytes, individualTotalBytes, compoundHex, compoundBytes } = results;
  const savings = individualTotalBytes - compoundBytes;
  const pct = individualTotalBytes > 0 ? Math.round((savings / individualTotalBytes) * 100) : 0;

  return (
    <div className="bump-comparison">
      <div className="bump-comparison__stats">
        <div className="bump-stat">
          <span className="bump-stat__label">Individual BUMPs</span>
          <span className="bump-stat__value bump-stat__value--individual">
            {individualTotalBytes} bytes
          </span>
          <span className="bump-stat__detail">
            {count} proof{count !== 1 ? 's' : ''} &times; {sampleBytes} B each
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
            Individual BUMP
            <span className="bump-panel__subtitle">
              Example — 1 of {count} identical-size proofs
            </span>
          </h3>
          <div className="bump-panel__scroll">
            <div className="bump-panel__block">
              <div className="bump-panel__block-label">
                tx: {displayAsIfItWereA32ByteHash(sampleHash).slice(0, 16)}…
                <span className="bump-panel__block-size">{sampleBytes} B</span>
              </div>
              <pre className="bump-panel__code">{sampleHex}</pre>
            </div>
          </div>
        </div>

        <div className="bump-panel bump-panel--compound">
          <h3 className="bump-panel__title">
            Compound BUMP
            <span className="bump-panel__subtitle">
              All {count} transactions in one proof
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
