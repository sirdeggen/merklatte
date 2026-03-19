import { MerkleProofByTx, TreePart } from "./merkle-tree-data";
import {
  createContext,
  FC,
  PropsWithChildren,
  useContext,
  useState,
} from "react";
import { useReset } from "./useReset.tsx";

interface ContextValue {
  value: MerkleProofByTx;
  setValue: (proof: MerkleProofByTx) => void;
  partitions: string[][] | null;
  setPartitions: (p: string[][] | null) => void;
  partitionCount: number;
  setPartitionCount: (n: number) => void;
}

const Context = createContext<ContextValue | undefined>(undefined);
Context.displayName = "MerkleProofsProviderCtx";

export const MerkleProofProvider: FC<PropsWithChildren> = ({ children }) => {
  const [value, setValue] = useState<MerkleProofByTx>({});
  const [partitions, setPartitions] = useState<string[][] | null>(null);
  const [partitionCount, setPartitionCount] = useState(5);
  const { addListener } = useReset();
  addListener("merkleproof", () => { setValue({}); setPartitions(null); });
  return (
    <Context.Provider
      value={{
        value,
        setValue,
        partitions,
        setPartitions,
        partitionCount,
        setPartitionCount,
      }}
    >
      {children}
    </Context.Provider>
  );
};

const useContextValue = () => {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error("useMerkleProofs must be used within MerkleProofProvider");
  }
  return ctx;
};

export const useMerklePath = () => {
  const ctx = useContextValue();
  return {
    proof: ctx.value,
    partitions: ctx.partitions,
    partitionCount: ctx.partitionCount,
    setPartitionCount: (n: number) => ctx.setPartitionCount(n),
    add: (hash: string, node: TreePart) => {
      const merkleProof = addNodeToProof(hash, node, ctx.value);
      ctx.setValue(merkleProof);
    },
    remove: (hash: string) => {
      const merkleProofs = ctx.value;
      delete merkleProofs[hash];
      ctx.setValue({ ...merkleProofs });
    },
    setProof: (proof: MerkleProofByTx) => {
      ctx.setValue({ ...proof });
    },
    setPartitions: (p: string[][] | null) => {
      ctx.setPartitions(p);
    },
  };
};

export const addNodeToProof = (
  hash: string,
  node: TreePart,
  proofs: MerkleProofByTx,
): MerkleProofByTx => {
  const merkleProof =
    hash in proofs
      ? proofs[hash]
      : {
          index: -1,
          path: [],
        };

  if (node.hash == hash && !node.duplicated) {
    merkleProof.index = node.offset;
  } else {
    const path = merkleProof.path;
    path.push(node);
  }

  proofs[hash] = merkleProof;
  return {
    ...proofs,
  };
};
