import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { MerklePath } from "@bsv/sdk";

interface BlockData {
  height: number;
  hash: string;
  txids: string[];
  merkleRoot: string;
  size?: number;
}

interface BlockDataContextValue {
  blockData: BlockData | null;
  fullBlockPath: MerklePath | null;
  loading: boolean;
  error: string | null;
  fetchBlock: (height: number) => Promise<void>;
  useFakeData: boolean;
  setUseFakeData: (fake: boolean) => void;
}

function buildAndExpandBlockPath(txids: string[], height: number): MerklePath {
  const level0 = txids.map((txid, idx) => ({ offset: idx, hash: txid, txid: true }));
  if (level0.length % 2 === 1) {
    (level0 as Array<{ offset: number; hash?: string; txid?: boolean; duplicate?: boolean }>)
      .push({ offset: level0.length, duplicate: true });
  }
  const singleLevel = new MerklePath(height, [level0]);
  try {
    return singleLevel.extract(txids);
  } catch {
    return singleLevel;
  }
}

const BlockDataContext = createContext<BlockDataContextValue | undefined>(
  undefined,
);

export const BlockDataProvider = ({ children }: { children: ReactNode }) => {
  const [blockData, setBlockData] = useState<BlockData | null>(null);
  const [fullBlockPath, setFullBlockPath] = useState<MerklePath | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useFakeData, setUseFakeData] = useState(false);

  useEffect(() => {
    if (!blockData?.txids?.length) {
      setFullBlockPath(null);
      return;
    }
    setFullBlockPath(buildAndExpandBlockPath(blockData.txids, blockData.height));
  }, [blockData]);

  const fetchBlock = async (height: number) => {
    setLoading(true);
    setError(null);
    try {
      if (useFakeData) {
        // Fake data for demo
        setBlockData({
          height,
          hash: "000000000000000000fakehash",
          txids: Array.from(
            { length: Math.min(32, (height % 64) + 8) },
            (_, i) => `txid_${i}_${height}`,
          ),
          merkleRoot: "fakeroot_" + height,
        });
        return;
      }

      // Real Whatsonchain API (BSV mainnet)
      const blockRes = await fetch(
        `https://api.whatsonchain.com/v1/bsv/main/block/height/${height}`,
      );
      if (!blockRes.ok) throw new Error(`Block not found: ${height}`);
      interface BlockResponse {
        tx: Array<string>;
        merkleroot: string;
        hash: string;
        size?: number;
      }
      const block = (await blockRes.json()) as BlockResponse;

      setBlockData({
        height,
        hash: block.hash,
        txids: block.tx,
        merkleRoot: block.merkleroot,
        size: block.size,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BlockDataContext.Provider
      value={{
        blockData,
        fullBlockPath,
        loading,
        error,
        fetchBlock,
        useFakeData,
        setUseFakeData,
      }}
    >
      {children}
    </BlockDataContext.Provider>
  );
};

export const useBlockData = () => {
  const ctx = useContext(BlockDataContext);
  if (!ctx)
    throw new Error("useBlockData must be used within BlockDataProvider");
  return ctx;
};
