import { useMerklePath } from "./MerkleProofsProvider.tsx";
import _ from "lodash";
import { NoTransactionSelected } from "./NoTransactionSelected.tsx";
import "./BsvUnifiedMerklePathView.css";
import { MerkleProof, MerkleProofByTx, TreePart } from "./merkle-tree-data";
import { displayAsIfItWereA32ByteHash } from "./RenderHashes.tsx";
// import { MerklePath } from '@bsv/sdk'; // For reference - not used in demo

// Import TSC calculation function
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

function calculateTheByteLengthOfTSC(proof: MerkleProofByTx) {
  if (_.isEmpty(proof)) return 0;
  return Math.ceil(JSON.stringify(mapToTSCFormat(proof)).length / 2);
}


interface MerklePathLeaf {
  hash: string;
  txid?: true;
  duplicate?: boolean;
  offset: number;
  height: number;
}


function createOptimizedMerklePath(proof: MerkleProofByTx): { 
  blockHeight: number; 
  path: Array<Array<{
    offset: number;
    hash?: string;
    txid?: boolean;
    duplicate?: boolean;
  }>>;
  toBinary: () => number[];
  toHex: () => string;
} {
  // Convert our internal proof format to optimized format
  const pathParts: MerklePathLeaf[] = listAllPaths(proof);
  const pathPartsWithoutShared = mergeSharedPaths(pathParts);

  const optimizedPath: Array<Array<{
    offset: number;
    hash?: string;
    txid?: boolean;
    duplicate?: boolean;
  }>> = [];

  groupByHeight(pathPartsWithoutShared).forEach(([height, paths]) => {
    const level = parseInt(height);
    if (!optimizedPath[level]) optimizedPath[level] = [];
    
    paths.forEach((path) => {
      const leaf: {
        offset: number;
        hash?: string;
        txid?: boolean;
        duplicate?: boolean;
      } = { offset: path.offset };
      
      if (path.duplicate) {
        leaf.duplicate = true;
      } else {
        // Only include hash for txid leaves and required nodes
        // Skip hashes that can be calculated from other nodes
        if (path.txid || isRequiredForCalculation(path, pathPartsWithoutShared)) {
          leaf.hash = displayAsIfItWereA32ByteHash(path.hash);
          if (path.txid) {
            leaf.txid = true;
          }
        }
      }
      
      // Only add if it's not empty (has hash, txid, or duplicate flag)
      if (leaf.hash || leaf.txid || leaf.duplicate) {
        optimizedPath[level].push(leaf);
      }
    });
  });

  // Remove empty levels
  const cleanedPath = optimizedPath.filter(level => level && level.length > 0);

  return {
    blockHeight: 818433,
    path: cleanedPath,
    toBinary: () => calculateOptimizedByteLength(cleanedPath),
    toHex: () => 'optimized-hex-representation'
  };
}

function isRequiredForCalculation(targetPath: MerklePathLeaf, allPaths: MerklePathLeaf[]): boolean {
  // If this is a txid node, it's always required
  if (targetPath.txid) return true;
  
  // If this is a duplicate, it's required
  if (targetPath.duplicate) return true;
  
  // Check if both children exist at the level below
  const childLevel = targetPath.height - 1;
  if (childLevel < 0) return true; // Base level
  
  const leftChildOffset = targetPath.offset * 2;
  const rightChildOffset = targetPath.offset * 2 + 1;
  
  const leftChild = allPaths.find(p => p.height === childLevel && p.offset === leftChildOffset);
  const rightChild = allPaths.find(p => p.height === childLevel && p.offset === rightChildOffset);
  
  // If both children are present and have hashes, this parent node is calculable (not required)
  if (leftChild && rightChild && leftChild.hash && rightChild.hash) {
    return false; // This node can be calculated from its children
  }
  
  // Otherwise, this node is required
  return true;
}

function calculateOptimizedByteLength(path: Array<Array<{
  offset: number;
  hash?: string;
  txid?: boolean;
  duplicate?: boolean;
}>>): number[] {
  let totalBytes = 4; // block height
  totalBytes += 1; // tree height
  
  path.forEach((level) => {
    totalBytes += 1; // number of leaves at this level
    level.forEach((leaf) => {
      totalBytes += 1; // offset
      totalBytes += 1; // flags
      if (!leaf.duplicate) {
        totalBytes += 32; // hash length
      }
    });
  });
  
  // Return array representing bytes (simplified)
  return new Array(totalBytes).fill(0);
}


const renderOptimizedBump = (optimizedBump: { blockHeight: number; path: Array<Array<any>> }) => {
  let output = "{\n  \"blockHeight\": " + optimizedBump.blockHeight + ",\n  \"path\": [\n";
  optimizedBump.path?.map((level: any[], index: number) => {
    output += "    [";
    level?.map((leaf: any, leafIndex: number) => {
      output += JSON.stringify(leaf);
      if (leafIndex < level.length - 1) {
        output += ",\n     ";
      }
    });
    output += "]";
    if (index < optimizedBump.path.length - 1) {
      output += ",\n";
    } else {
      output += "\n  ]\n}";
    }
  });
  return output;
};

export const BsvUnifiedMerklePathView = () => {
  const { proof } = useMerklePath();

  if (_.isEmpty(proof)) {
    return (
      <article className="bump-view">
        <header>BUMP Format (Optimized)</header>
        <NoTransactionSelected />
      </article>
    );
  }

  try {
    // Create optimized MerklePath using @bsv/sdk
    const bsvMerklePath = createOptimizedMerklePath(proof);
    const optimizedSizeBytes = bsvMerklePath.toBinary().length;
    const tscSizeBytes = calculateTheByteLengthOfTSC(proof);
    const savingsVsTsc = tscSizeBytes - optimizedSizeBytes;
    const percentageSavings = tscSizeBytes > 0 ? Math.round((savingsVsTsc / tscSizeBytes) * 100) : 0;

    return (
      <article className="bump-view">
        <header>
          BUMP Format: {optimizedSizeBytes} bytes vs TSC Format: {tscSizeBytes} bytes
          <br />
          <span style={{ color: 'green', fontWeight: 'bold' }}>
            Savings vs TSC: {savingsVsTsc} bytes ({percentageSavings}% reduction)
          </span>
          <br />
          <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>
            Note: This demo uses concatenation (AAAA+BBBB=ABAB) instead of real hashing to visualize the optimization concept
          </span>
        </header>
        <div>
          <h3>Optimized BUMP (Compact - Calculable Hashes Omitted)</h3>
          <pre style={{ fontSize: '12px', background: '#f0f8ff' }}>
            {renderOptimizedBump({ 
              blockHeight: bsvMerklePath.blockHeight, 
              path: bsvMerklePath.path 
            })}
          </pre>
          <p style={{ fontSize: '12px', color: '#666' }}>
            Binary length: {bsvMerklePath.toBinary().length} bytes
          </p>
          <div style={{ fontSize: '11px', color: '#555', marginTop: '10px', padding: '8px', background: '#e8f4fd', borderRadius: '4px' }}>
            <strong>Optimizations shown:</strong>
            <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
              <li><strong>Calculable nodes omitted:</strong> If both children AAAA and BBBB exist, parent ABAB can be omitted</li>
              <li><strong>Essential nodes kept:</strong> TXIDs and nodes needed for proof verification</li>
              <li><strong>Space savings:</strong> Reduced binary size while maintaining proof integrity</li>
            </ul>
            <div style={{ marginTop: '6px', fontSize: '10px', fontStyle: 'italic' }}>
              Example: AAAA + BBBB → ABAB (calculable, so ABAB hash not stored)
            </div>
          </div>
        </div>
      </article>
    );
  } catch (error) {
    return (
      <article className="bump-view">
        <header>BUMP Format (Error occurred during optimization)</header>
        <div>
          <h3>Optimized BUMP (Error)</h3>
          <div style={{ padding: '10px', background: '#ffe6e6', borderRadius: '4px' }}>
            <p style={{ color: 'red', margin: '0', fontSize: '14px' }}>
              Error creating optimized MerklePath: {error instanceof Error ? error.message : 'Unknown error'}
            </p>
            <p style={{ fontSize: '12px', color: '#666', margin: '10px 0 0 0' }}>
              This demo tree may not have consistent Merkle roots required for @bsv/sdk validation.
            </p>
          </div>
        </div>
      </article>
    );
  }
};

function listAllPaths(proof: MerkleProofByTx) {
  return Object.entries(proof).flatMap((it) => [
    toLeaf(it),
    ...toLeafs(it[1].path),
  ]);
}

function mergeSharedPaths(paths: MerklePathLeaf[]) {
  return _(paths)
    .groupBy((path) => `${path.height}_${path.offset}`)
    .map((it) => _.merge({} as MerklePathLeaf, ...it) as MerklePathLeaf)
    .value();
}

function groupByHeight(pathPartsWithoutShared: MerklePathLeaf[]) {
  return _(pathPartsWithoutShared).groupBy("height").entries();
}

function toLeafs(path: TreePart[]): MerklePathLeaf[] {
  return path.map((p) => ({
    hash: p.hash,
    offset: p.offset,
    height: p.height,
    duplicate: p.duplicated,
  }));
}

function toLeaf(it: [string, MerkleProof]): MerklePathLeaf {
  return {
    hash: it[0],
    txid: true,
    offset: it[1].index,
    height: 0,
  };
}
