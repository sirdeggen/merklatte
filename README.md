# Merklatte - Merkle Path Visualizer

A frontend application for visualising BSV Unified Merkle Paths (BUMP) and demonstrating the efficiency gains of compound proofs when multiple businesses share a block.

<img width="1738" height="1283" alt="image" src="https://github.com/user-attachments/assets/e7363f02-5091-4702-9b69-f5b9f8db3b75" />

## Live Demo

https://sirdeggen.github.io/merklatte/

---

## How It Works

### 1. Load a Block

Enter a BSV mainnet block height and click **Load Block**. The app fetches the block's transaction IDs from WhatsOnChain and builds a Merkle tree, which is displayed in the upper panel.

### 2. Set the Number of Businesses

Use the **Businesses** input to choose how many businesses to simulate (2 – up to the number of transactions in the block). This controls how many compound BUMPs will be calculated.

### 3. Emulate a Merkle Service

Click **Emulate Merkle Service** to randomly assign all block transactions across the configured number of businesses. Each business receives an uneven share of the transactions, reflecting a realistic distribution. The button also randomises the business count within the allowed range.

- The Merkle tree view updates to highlight only **Business 1's** transactions.
- The bottom panel recomputes all compound BUMPs and displays the size comparison stats.

Changing the **Businesses** input after emulation re-partitions businesses 2–N while keeping Business 1's selection intact.

### 4. Manual Selection

Click any leaf node in the Merkle tree to manually select or deselect transactions for **Business 1**. The compound BUMP for Business 1 and all size statistics update live.

---

## Size Comparison Stats

After emulation or manual selection, the stats bar shows five figures:

| Stat | What it represents |
|---|---|
| **N× Full Tree** | Worst case — each business transmits the full list of all txids (N × txCount × 32 B) |
| **Individual BUMPs** | Each transaction carries its own independent Merkle proof |
| **N Compound BUMPs** | One targeted compound proof per business, covering only their transactions |
| **Full Block BUMP** | A single compound proof covering every transaction in the block |
| **Raw Block Data** | The actual byte size of all transaction data in the block (from WhatsOnChain) |

The prominent **Saved** banner at the top shows the percentage reduction achieved by compound BUMPs compared to individual proofs and the full-tree approach.

---

## Key Concepts

**Compound BUMP** — a single BSV Unified Merkle Path that proves membership for multiple transactions simultaneously. Shared intermediate hashes are included only once, making the proof far smaller than N individual proofs concatenated.

**Why it matters** — a Merkle service (e.g. a block explorer or SPV infrastructure provider) can issue each downstream business a single compact proof covering only their transactions, rather than requiring them to download the full block or verify each transaction individually. As the number of businesses and transactions grows, the savings compound significantly.

---

## Tech Stack

- **React + TypeScript** (Vite)
- **@bsv/sdk** — MerklePath construction and binary serialisation
- **Material UI** — component library
- **WhatsOnChain API** — BSV mainnet block data
