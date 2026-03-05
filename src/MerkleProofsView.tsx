import "./MerkleProofsView.css";
import { FC } from "react";
import { useMerklePath } from "./MerkleProofsProvider.tsx";
import { MerkleProofByTx } from "./merkle-tree-data";
import * as _ from "lodash";
import { NoTransactionSelected } from "./NoTransactionSelected.tsx";

const MerkleProofList: FC<{ proof: MerkleProofByTx }> = ({ proof }) => {
  return (
    <div className="merkle-proofs">
      {Object.entries(proof)
        .map((it) => ({ ...it[1], txid: it[0] }))
        .map((it) => ({ ...it, path: it.path.map((p) => p.hash) }))
        .map((it) => (
          <pre key={it.txid}>{JSON.stringify(it, null, 2)}</pre>
        ))}
    </div>
  );
};

export const MerkleProofsView = () => {
  const { proof } = useMerklePath();

  return (
    <div className="merkle-proofs-view">
      <header>Merkle Path(s):</header>
      {_.isEmpty(proof) ? (
        <NoTransactionSelected />
      ) : (
        <MerkleProofList proof={proof} />
      )}
    </div>
  );
};
