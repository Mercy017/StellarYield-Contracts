import type { Epoch } from "../types/index.js";
import { query } from "../db/index.js";

export class YieldService {
  async getVaultEpochs(_contractId: string): Promise<Epoch[]> {
    throw new Error("Not implemented");
  }

  async getUserPendingYield(
    _contractId: string,
    _userAddress: string,
  ): Promise<{ pendingYield: string; epochs: number[] }> {
    throw new Error("Not implemented");
  }

  async recordEpoch(
    vaultId: number,
    epoch: number,
    yieldAmount: string,
    totalShares: string,
  ): Promise<void> {
    await query(
      `INSERT INTO epochs (vault_id, epoch, yield_amount, total_shares, distributed_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (vault_id, epoch) DO NOTHING`,
      [vaultId, epoch, yieldAmount, totalShares],
    );
  }
}
