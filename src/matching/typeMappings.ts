import { AssetAliasMap, TypeMapping } from '../types'

export const DEFAULT_TYPE_MAPPINGS: TypeMapping = {
  TRANSFER_IN: 'TRANSFER_OUT',
  TRANSFER_OUT: 'TRANSFER_IN',
}

export const DEFAULT_ASSET_ALIASES: AssetAliasMap = {
  bitcoin: 'BTC',
  bitcoin_cash: 'BCH',
  ethereum: 'ETH',
  solana: 'SOL',
}
