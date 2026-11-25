import { NextRequest, NextResponse } from 'next/server';
import { communityChatEngine } from '@/lib/research/CommunityChatEngine';
import { liveChartTelemetryService } from '@/lib/research/LiveChartTelemetryService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSymbol = searchParams.get('symbol') || 'NVDA';
    const timeframe = searchParams.get('timeframe') || '1h';
    const tag = searchParams.get('tag') || undefined;
    const livePriceParam = parseFloat(searchParams.get('livePrice') || '');
    const changePctParam = parseFloat(searchParams.get('changePercent') || '');
    const rsiParam = parseFloat(searchParams.get('rsi14') || '');
    const ema20Param = parseFloat(searchParams.get('ema20') || '');
    const macdParam = parseFloat(searchParams.get('macdHistogram') || '');

    const resolved = liveChartTelemetryService.resolveSymbol(rawSymbol);
    const liveTelemetry =
      Number.isFinite(livePriceParam) && livePriceParam > 0
        ? {
            livePrice: livePriceParam,
            changePercent: Number.isFinite(changePctParam) ? changePctParam : undefined,
            timeframe,
            rsi14: Number.isFinite(rsiParam) ? rsiParam : undefined,
            ema20: Number.isFinite(ema20Param) ? ema20Param : undefined,
            macdHistogram: Number.isFinite(macdParam) ? macdParam : undefined,
            assetClass: resolved.assetClass,
          }
        : await liveChartTelemetryService.fetchLiveChartTelemetry(resolved.symbol, timeframe).then((ctx) => ({
            livePrice: ctx.livePrice,
            changePercent: ctx.changePercent,
            timeframe: ctx.timeframe,
            rsi14: ctx.indicatorReadings.rsi14,
            ema20: ctx.indicatorReadings.ema20,
            ema50: ctx.indicatorReadings.ema50,
            macdHistogram: ctx.indicatorReadings.macdHistogram,
            atr14: ctx.indicatorReadings.atr14,
            assetClass: resolved.assetClass,
          }));

    communityChatEngine.syncWithLiveTelemetry(resolved.symbol, liveTelemetry);

    const transcript = communityChatEngine.getBufferedTranscript(resolved.symbol, liveTelemetry.livePrice);
    const messages = communityChatEngine.getMessagesForSymbol(resolved.symbol, tag);

    return NextResponse.json({
      success: true,
      symbol: resolved.symbol,
      livePrice: liveTelemetry.livePrice,
      transcript,
      messages,
      messageCount: messages.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch community chat messages' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { symbol, username, message, sentiment, badges, chartContext } = body;

    if (!symbol || !message) {
      return NextResponse.json(
        { success: false, error: 'Both symbol and message are required' },
        { status: 400 }
      );
    }

    const resolved = liveChartTelemetryService.resolveSymbol(symbol);
    if (chartContext?.livePrice > 0) {
      communityChatEngine.syncWithLiveTelemetry(resolved.symbol, {
        livePrice: chartContext.livePrice,
        changePercent: chartContext.changePercent,
        timeframe: chartContext.timeframe,
        rsi14: chartContext.indicatorReadings?.rsi14,
        ema20: chartContext.indicatorReadings?.ema20,
        ema50: chartContext.indicatorReadings?.ema50,
        macdHistogram: chartContext.indicatorReadings?.macdHistogram,
        atr14: chartContext.indicatorReadings?.atr14,
        assetClass: resolved.assetClass,
      });
    }

    const dispatched = communityChatEngine.dispatchUserMessage({
      symbol: resolved.symbol,
      username: username || 'You (Trader)',
      message,
      sentiment,
      badges: badges || ['COMMUNITY'],
    });

    const transcript = communityChatEngine.getBufferedTranscript(
      resolved.symbol,
      chartContext?.livePrice
    );

    return NextResponse.json({
      success: true,
      symbol: resolved.symbol,
      message: dispatched,
      transcript,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to dispatch chat message' },
      { status: 500 }
    );
  }
}
