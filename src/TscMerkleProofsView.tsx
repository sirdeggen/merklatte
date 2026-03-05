import "./TscMerkleProofsView.css";
import { FC } from "react";
import { useMerklePath } from "./MerkleProofsProvider.tsx";
import { MerkleProofByTx } from "./merkle-tree-data";
import * as _ from "lodash";
import { NoTransactionSelected } from "./NoTransactionSelected.tsx";
import { displayAsIfItWereA32ByteHash } from "./RenderHashes.tsx";

function mapToTSCFormat(proof: MerkleProofByTx) {
  return Object.entries(proof)
    .map((it) => ({
      index: it[1].index,
      txOrId: displayAsIfItWereA32ByteHash(it[0]),
      targetType: "header",
      target: "000000000000000002bcc1bbe47c4def6a9c1440e9c1b2200fc6a650a0552904",
      nodes: it[1].path,
    }))
    .map((it) => ({ ...it, nodes: it.nodes.map((n) => displayAsIfItWereA32ByteHash(n.hash)) }))
}

const TscMerkleProofList: FC<{ proof: MerkleProofByTx }> = ({ proof }) => {
  return (
    <div className="tsc-merkle-proofs">
      {mapToTSCFormat(proof)
        .map((it) => (
          <TscMerkleProof key={it.txOrId} proof={it} />
        ))}
    </div>
  );
};

export interface TscMerkleProofFormat {
  index: number;
  txOrId: string;
  targetType: string;
  target: string;
  nodes: string[];
}

const TscMerkleProof: FC<{ proof: TscMerkleProofFormat }> = ({ proof }) => {
  return <pre>{JSON.stringify(proof, null, 2)}</pre>;
};

function calculateTheByteLengthOfTSC(proof: MerkleProofByTx) {
  if (_.isEmpty(proof)) return 0;
  return Math.ceil(JSON.stringify(mapToTSCFormat(proof)).length / 2);
}

export const TscMerkleProofsView = () => {
  const { proof } = useMerklePath();

  return (
    <div style={{ marginTop: "45px" }}>
      <header>TSC Format Merkle Proofs [DEPRECATED]: {calculateTheByteLengthOfTSC(proof)} bytes</header>
      <div className="tsc-merkle-proofs-view">
        {_.isEmpty(proof) ? (
          <NoTransactionSelected />
        ) : (
          <TscMerkleProofList proof={proof} />
        )}
      </div>
    </div>
  );
};
