import type { CryptoOnChainSnapshot } from './types';
import { seededRange } from './helpers';

const DECODED_CONTRACT_LOGS: Array<{
  block_number: number;
  block_time: string;
  protocol: string;
  event_name: string;
  from_label: string;
  to_label: string;
  token: string;
  amount_usd: number;
  tx_hash: string;
}> = [
  { block_number: 21490812, block_time: '2026-11-26 06:58:12', protocol: 'Uniswap V3', event_name: 'Swap', from_label: 'Wintermute_MM', to_label: 'USDC_ETH_Pool', token: 'WETH', amount_usd: 4280000, tx_hash: '0x9a14...f2c8' },
  { block_number: 21490809, block_time: '2026-11-26 06:57:36', protocol: 'Aave V3', event_name: 'Supply', from_label: 'SmartMoney_Fund_04', to_label: 'Aave_WrappedBTC', token: 'WBTC', amount_usd: 9640000, tx_hash: '0x71b0...e19a' },
  { block_number: 21490794, block_time: '2026-11-26 06:54:00', protocol: 'Coinbase Prime', event_name: 'Transfer', from_label: 'Coinbase_Hot_02', to_label: 'Cold_Custody_Inst', token: 'ETH', amount_usd: 14120000, tx_hash: '0x3f88...041b' },
  { block_number: 21490775, block_time: '2026-11-26 06:50:12', protocol: 'Lido Staking', event_name: 'Submitted', from_label: 'Whale_0x89d', to_label: 'stETH_Contract', token: 'ETH', amount_usd: 6150000, tx_hash: '0x54c2...9a31' },
  { block_number: 21490761, block_time: '2026-11-26 06:47:24', protocol: 'Curve Finance', event_name: 'TokenExchange', from_label: 'Tether_Treasury_MM', to_label: '3pool_USDT_USDC', token: 'USDT', amount_usd: 11800000, tx_hash: '0x12ea...88dc' },
  { block_number: 21490740, block_time: '2026-11-26 06:43:00', protocol: 'MakerDAO / Sky', event_name: 'VaultMint', from_label: 'Abraxas_Capital', to_label: 'USDS_Treasury', token: 'USDS', amount_usd: 5400000, tx_hash: '0x88ef...20ab' },
];

const DEFAULT_SQL = 'SELECT block_time, protocol, event_name, from_label, token, amount_usd FROM decoded_logs WHERE amount_usd >= 5000000 ORDER BY amount_usd DESC LIMIT 6';

export class CryptoOnChainEngine {
  private static instance: CryptoOnChainEngine;

  private constructor() {}

  public static getInstance(): CryptoOnChainEngine {
    if (!CryptoOnChainEngine.instance) {
      CryptoOnChainEngine.instance = new CryptoOnChainEngine();
    }
    return CryptoOnChainEngine.instance;
  }

  /**
   * Executes safe structured SQL queries (Dune Analytics style) over indexed decoded smart-contract logs.
   */
  public executeDecodedLogsSql(rawQuery: string = DEFAULT_SQL): CryptoOnChainSnapshot['sqlQueryResult'] {
    const start = performance.now();
    const query = rawQuery.trim() || DEFAULT_SQL;

    let rows = [...DECODED_CONTRACT_LOGS];

    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);
    if (whereMatch) {
      const cond = whereMatch[1].trim();
      const numCmp = cond.match(/^([a-z_]+)\s*(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)$/i);
      const strCmp = cond.match(/^([a-z_]+)\s*=\s*'([^']+)'$/i);
      if (numCmp) {
        const [, col, op, valStr] = numCmp;
        const target = Number(valStr);
        rows = rows.filter((r) => {
          const cell = Number((r as Record<string, any>)[col]);
          if (!Number.isFinite(cell)) return false;
          if (op === '>=') return cell >= target;
          if (op === '<=') return cell <= target;
          if (op === '>') return cell > target;
          if (op === '<') return cell < target;
          return cell === target;
        });
      } else if (strCmp) {
        const [, col, strVal] = strCmp;
        rows = rows.filter((r) => String((r as Record<string, any>)[col] || '').toLowerCase() === strVal.toLowerCase());
      }
    }

    const orderMatch = query.match(/ORDER\s+BY\s+([a-z_]+)(?:\s+(ASC|DESC))?/i);
    if (orderMatch) {
      const col = orderMatch[1];
      const dir = (orderMatch[2] || 'ASC').toUpperCase() === 'DESC' ? -1 : 1;
      rows.sort((a, b) => {
        const va = (a as Record<string, any>)[col];
        const vb = (b as Record<string, any>)[col];
        return va > vb ? dir : va < vb ? -dir : 0;
      });
    }

    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      rows = rows.slice(0, Math.max(1, Math.min(25, Number(limitMatch[1]))));
    }

    const selectMatch = query.match(/^SELECT\s+(.+?)\s+FROM\s+/i);
    const allCols = Object.keys(DECODED_CONTRACT_LOGS[0]);
    const requestedCols =
      selectMatch && selectMatch[1].trim() !== '*'
        ? selectMatch[1].split(',').map((s) => s.trim()).filter((c) => allCols.includes(c))
        : allCols;
    const columns = requestedCols.length > 0 ? requestedCols : allCols;

    const projected = rows.map((row) => {
      const out: Record<string, string | number> = {};
      for (const c of columns) {
        out[c] = (row as Record<string, string | number>)[c];
      }
      return out;
    });

    return {
      query,
      columns,
      rows: projected,
      executionTimeMs: Number(Math.max(1.2, performance.now() - start + 2.4).toFixed(2)),
    };
  }

  public getSnapshot(params?: { asset?: string; sqlQuery?: string }): CryptoOnChainSnapshot {
    const asset = (params?.asset || 'BTC/USD').toUpperCase();
    const spotPrice = asset.includes('ETH') ? 3410 : asset.includes('SOL') ? 218.4 : 96420;

    return {
      asset,
      spotPrice,
      soprMetrics: {
        entityAdjustedSopr: Number(seededRange(`${asset}:asopr`, 1.01, 1.09).toFixed(3)),
        sthSopr: Number(seededRange(`${asset}:sthsopr`, 0.99, 1.06).toFixed(3)),
        lthSopr: Number(seededRange(`${asset}:lthsopr`, 1.62, 2.85).toFixed(2)),
        realizedPriceUsd: Math.round(spotPrice * 0.59),
        mvrvZScore: Number(seededRange(`${asset}:mvrv`, 1.8, 3.6).toFixed(2)),
      },
      exchangeNetflows: [
        { venue: 'Coinbase Institutional', netflow24hUsdMillions: -184.5, reserveUnits: 812400, clusterStatus: 'ACCUMULATION_OUTFLOW' },
        { venue: 'Binance Main', netflow24hUsdMillions: -62.1, reserveUnits: 548120, clusterStatus: 'ACCUMULATION_OUTFLOW' },
        { venue: 'OKX Custody', netflow24hUsdMillions: 29.4, reserveUnits: 194300, clusterStatus: 'DISTRIBUTION_INFLOW' },
        { venue: 'Kraken Pro', netflow24hUsdMillions: -18.2, reserveUnits: 141900, clusterStatus: 'NEUTRAL' },
      ],
      smartMoneyLabels: [
        { walletTag: '0x71C...92A (Wintermute Trading)', cohort: 'MARKET_MAKER', netChange24hUsd: 4250000, balanceUsdMillions: 148.2, action: 'ROTATING' },
        { walletTag: '0x49B...3E1 (ParaFi Smart Fund)', cohort: 'SMART_MONEY_FUND', netChange24hUsd: 11800000, balanceUsdMillions: 312.6, action: 'ACCUMULATING' },
        { walletTag: 'bc1q...9xk (Sovereign Cold Cluster)', cohort: 'WHALE_ACCUMULATOR', netChange24hUsd: 26400000, balanceUsdMillions: 1920.0, action: 'ACCUMULATING' },
        { walletTag: '0x88E...11D (Early Seed Vesting)', cohort: 'EARLY_VC', netChange24hUsd: -1450000, balanceUsdMillions: 64.5, action: 'REDUCING' },
      ],
      tokenHolderDistribution: {
        top10HoldersPct: 14.8,
        cexCustodyPct: 11.4,
        stakingLockedPct: 28.6,
        giniCoefficient: 0.74,
        uniqueActiveAddresses24h: 918420,
      },
      minerReserves: {
        reserveUnits: 1814200,
        puellMultiple: 1.38,
        mpiIndex: -0.42,
        hashrateExahash: 742.5,
      },
      stablecoinReserves: {
        stablecoinSupplyRatio: 4.82,
        exchangeStablecoinUsdBillions: 34.9,
        netMint24hMillions: 412.0,
      },
      l3OrderBookSnapshots: [
        { exchange: 'Coinbase', orderId: 'L3_99812041', side: 'BID', price: Number((spotPrice * 0.9996).toFixed(2)), size: 4.85, queuePosition: 1, nanosecondTs: '06:58:12.401992814' },
        { exchange: 'Binance', orderId: 'L3_88420193', side: 'ASK', price: Number((spotPrice * 1.0004).toFixed(2)), size: 6.12, queuePosition: 1, nanosecondTs: '06:58:12.402104512' },
        { exchange: 'OKX', orderId: 'L3_55129044', side: 'BID', price: Number((spotPrice * 0.9991).toFixed(2)), size: 12.4, queuePosition: 3, nanosecondTs: '06:58:12.403881092' },
      ],
      crossExchangeLiquidityDepth: [
        { exchange: 'Binance Spot/Perp', plus1PctDepthUsdM: 48.2, minus1PctDepthUsdM: 51.6, spreadBps: 0.4, slippage1MSlipBps: 1.2 },
        { exchange: 'Coinbase Advanced', plus1PctDepthUsdM: 32.4, minus1PctDepthUsdM: 34.1, spreadBps: 0.9, slippage1MSlipBps: 1.8 },
        { exchange: 'OKX Perp', plus1PctDepthUsdM: 29.8, minus1PctDepthUsdM: 28.4, spreadBps: 0.6, slippage1MSlipBps: 2.1 },
        { exchange: 'Kraken Pro', plus1PctDepthUsdM: 14.6, minus1PctDepthUsdM: 15.9, spreadBps: 1.4, slippage1MSlipBps: 3.4 },
      ],
      fundingArbitrageMatrix: [
        { venue: 'Binance USD-M Perp', funding8hPct: 0.0142, annualizedFundingPct: 15.55, spotPerpBasisBps: 18.4, carryArbSpreadPct: 11.2 },
        { venue: 'Bybit USDT Perp', funding8hPct: 0.0185, annualizedFundingPct: 20.26, spotPerpBasisBps: 22.1, carryArbSpreadPct: 15.9 },
        { venue: 'Deribit Perp', funding8hPct: 0.0094, annualizedFundingPct: 10.29, spotPerpBasisBps: 11.5, carryArbSpreadPct: 5.9 },
        { venue: 'dYdX V4 On-Chain', funding8hPct: 0.0221, annualizedFundingPct: 24.20, spotPerpBasisBps: 25.0, carryArbSpreadPct: 19.8 },
      ],
      openInterestHeatmap: [-4, -2, 0, 2, 4].map((pct, idx) => {
        const b = Math.round(seededRange(`${asset}:oib:${idx}`, 120, 680));
        const by = Math.round(seededRange(`${asset}:oiby:${idx}`, 95, 520));
        const ok = Math.round(seededRange(`${asset}:oiok:${idx}`, 80, 410));
        const der = Math.round(seededRange(`${asset}:oider:${idx}`, 65, 340));
        return {
          priceBucket: Number((spotPrice * (1 + pct / 100)).toFixed(2)),
          binanceOiM: b,
          bybitOiM: by,
          okxOiM: ok,
          deribitOiM: der,
          totalOiM: b + by + ok + der,
        };
      }),
      tokenUnlocks: [
        { token: 'ARB', unlockDate: 'In 6 Days (Cliff)', unlockUsdMillions: 94.2, circulatingSupplyPct: 2.34, allocationType: 'INVESTORS' },
        { token: 'SUI', unlockDate: 'In 11 Days (Linear)', unlockUsdMillions: 142.8, circulatingSupplyPct: 1.85, allocationType: 'ECOSYSTEM' },
        { token: 'SOL', unlockDate: 'Monthly Staking Epoch', unlockUsdMillions: 61.5, circulatingSupplyPct: 0.14, allocationType: 'ECOSYSTEM' },
      ],
      protocolBalanceSheets: [
        { protocol: 'Ethereum L1 (Fee Burn / Rev)', fees30dUsdM: 184.2, protocolRevenue30dUsdM: 142.6, supplySideFees30dUsdM: 41.6, treasuryUsdM: 920.0, psRatio: 41.8 },
        { protocol: 'Uniswap Protocol (DEX)', fees30dUsdM: 96.4, protocolRevenue30dUsdM: 18.2, supplySideFees30dUsdM: 78.2, treasuryUsdM: 3180.0, psRatio: 9.4 },
        { protocol: 'Aave V3 Lending', fees30dUsdM: 44.8, protocolRevenue30dUsdM: 8.9, supplySideFees30dUsdM: 35.9, treasuryUsdM: 185.0, psRatio: 16.2 },
      ],
      sqlQueryResult: this.executeDecodedLogsSql(params?.sqlQuery),
    };
  }
}

export const cryptoOnChainEngine = CryptoOnChainEngine.getInstance();
