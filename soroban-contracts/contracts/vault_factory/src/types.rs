//! Shared types for VaultFactory.

use soroban_sdk::{contracttype, Address, String};

/// Vault type — mirrors the Solidity VaultType enum.
#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum VaultType {
    SingleRwa,
    Aggregator,
}

/// Vault registration metadata.
///
/// Fields added for issue #515 (operatorFeeBps), #516 (maturityDate),
/// and #517 (expectedApy) so that frontends can display fee, maturity,
/// and APY data without an additional on-chain read.
#[contracttype]
#[derive(Clone, Debug)]
pub struct VaultInfo {
    pub vault: Address,
    pub asset: Address,
    pub vault_type: VaultType,
    pub name: String,
    pub symbol: String,
    pub active: bool,
    pub created_at: u64,
    /// Operator fee in basis points (issue #515). Sourced from
    /// `early_redemption_fee_bps` set at vault creation.
    pub operator_fee_bps: u32,
    /// Unix timestamp (seconds) at which the vault matures (issue #516).
    pub maturity_date: u64,
    /// Expected APY in basis points as encoded on-chain (issue #517).
    pub expected_apy: u32,
}

/// Parameters for batch vault creation (mirrors BatchVaultParams in Solidity).
#[contracttype]
#[derive(Clone, Debug)]
pub struct BatchVaultParams {
    pub asset: Address,
    pub name: String,
    pub symbol: String,
    pub rwa_name: String,
    pub rwa_symbol: String,
    pub rwa_document_uri: String,
    pub rwa_category: String,
    pub expected_apy: u32,
    pub maturity_date: u64,
    pub funding_deadline: u64,
    pub funding_target: i128,
    pub min_deposit: i128,
    pub max_deposit_per_user: i128,
    pub early_redemption_fee_bps: u32,
}

/// Parameters for `create_single_rwa_vault_full`.
/// Identical fields to BatchVaultParams but named separately for clarity.
pub type CreateVaultParams = BatchVaultParams;
