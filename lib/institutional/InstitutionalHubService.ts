import type { TimeFrame } from '../types';
import type { InstitutionalDebateEnrichment, InstitutionalOverviewPayload } from './types';
import { executionBridgeEngine } from './ExecutionBridgeEngine';
import { microstructureEngine } from './MicrostructureEngine';
import { fundamentalMacroEngine } from './FundamentalMacroEngine';
import { technicalScreenerEngine } from './TechnicalScreenerEngine';
import { optionsDerivativesEngine } from './OptionsDerivativesEngine';
import { cryptoOnChainEngine } from './CryptoOnChainEngine';
import { alternativeDataEngine } from './AlternativeDataEngine';
import { quantBacktestEngine } from './QuantBacktestEngine';
import { journalRiskAuditEngine } from './JournalRiskAuditEngine';
import { resolveInstitutionalAssetContext } from './helpers';

export class InstitutionalHubService {
  private static instance: InstitutionalHubService;

  private constructor() {}

  public static getInstance(): InstitutionalHubService {
    if (!InstitutionalHubService.instance) {
      InstitutionalHubService.instance = new InstitutionalHubService();
    }
    return InstitutionalHubService.instance;
  }

  /**
   * Computes additive enrichment payload connecting Execution Bridge, Zero Gamma,
   * Novelty News, Alt Data Alpha, and On-Chain SOPR into Seven-Agent Debate & PDF Tear Sheets
   * without mutating any existing Debate or MT5 state.
   */
  public getDebateEnrichment(symbol: string = 'XAU/USD', timeframe: TimeFrame = '1h'): InstitutionalDebateEnrichment {
    const ctx = resolveInstitutionalAssetContext(symbol, timeframe);
    const exec = executionBridgeEngine.getSnapshot({ symbol: ctx.symbol, timeframe });
    const opts = optionsDerivativesEngine.getSnapshot({ symbol: ctx.symbol, timeframe });
    const alt = alternativeDataEngine.getSnapshot({ symbol: ctx.symbol, timeframe });
    const onchain = cryptoOnChainEngine.getSnapshot({ asset: ctx.symbol });

    const scoreSignals =
      (alt.compositeAltAlphaScore >= 68 ? 1 : -1) +
      (opts.spotPrice >= opts.zeroGammaFlipLevel ? 1 : -1) +
      (onchain.soprMetrics.entityAdjustedSopr >= 1.0 ? 1 : -1);

    const institutionalCompositeBias: InstitutionalDebateEnrichment['institutionalCompositeBias'] =
      scoreSignals >= 3
        ? 'STRONG_BULLISH'
        : scoreSignals >= 1
        ? 'BULLISH'
        : scoreSignals <= -3
        ? 'STRONG_BEARISH'
        : scoreSignals <= -1
        ? 'BEARISH'
        : 'NEUTRAL';

    return {
      symbol: ctx.symbol,
      spotPrice: ctx.spotPrice,
      institutionalCompositeBias,
      confidenceBoost: Number((alt.compositeAltAlphaScore * 0.08).toFixed(1)),
      zeroGammaFlipLevel: opts.zeroGammaFlipLevel,
      dealerGammaRegime: opts.gammaRegime,
      slippageBps: exec.slippageEstimate.totalSlippageBps,
      altDataAlphaScore: alt.compositeAltAlphaScore,
      newsNoveltyEns: alt.newsNoveltyScores[0]?.ensNoveltyScore ?? 75,
      soprSignal: `aSOPR ${onchain.soprMetrics.entityAdjustedSopr} / MVRV-Z ${onchain.soprMetrics.mvrvZScore}`,
      summaryBulletPoints: [
        `FIX 4.4 / MT5 Bridge: ${exec.slippageEstimate.totalSlippageBps} bps modeled L2 slippage across ${exec.smartRouting.length} venues`,
        `Dealer Gamma Regime: ${opts.gammaRegime} (Zero Gamma Flip @ ${opts.zeroGammaFlipLevel})`,
        `Alt Data & Novelty: Composite Alpha ${alt.compositeAltAlphaScore}/100 (RavenPack ENS ${alt.newsNoveltyScores[0]?.ensNoveltyScore})`,
        `On-Chain & Macro: aSOPR=${onchain.soprMetrics.entityAdjustedSopr}, Funding Arb up to ${Math.max(...onchain.fundingArbitrageMatrix.map((f) => f.annualizedFundingPct))}% APR`,
      ],
    };
  }

  public getFullOverview(symbol: string = 'XAU/USD', timeframe: TimeFrame = '1h'): InstitutionalOverviewPayload {
    const ctx = resolveInstitutionalAssetContext(symbol, timeframe);
    return {
      symbol: ctx.symbol,
      timeframe: ctx.timeframe,
      spotPrice: ctx.spotPrice,
      mt5BridgeStatus: 'PRESERVED_AND_ACTIVE',
      debateEnrichment: this.getDebateEnrichment(ctx.symbol, ctx.timeframe),
      execution: executionBridgeEngine.getSnapshot({ symbol: ctx.symbol, timeframe }),
      microstructure: microstructureEngine.getSnapshot({ symbol: ctx.symbol, timeframe }),
      macro: fundamentalMacroEngine.getSnapshot({ symbol: ctx.symbol, timeframe }),
      screener: technicalScreenerEngine.getSnapshot({ symbol: ctx.symbol, timeframe }),
      options: optionsDerivativesEngine.getSnapshot({ symbol: ctx.symbol, timeframe }),
      crypto: cryptoOnChainEngine.getSnapshot({ asset: ctx.symbol }),
      altData: alternativeDataEngine.getSnapshot({ symbol: ctx.symbol, timeframe }),
      quant: quantBacktestEngine.getSnapshot({ symbol: ctx.symbol, timeframe }),
      riskAudit: journalRiskAuditEngine.getSnapshot({ symbol: ctx.symbol, timeframe }),
    };
  }
}

export const institutionalHubService = InstitutionalHubService.getInstance();
