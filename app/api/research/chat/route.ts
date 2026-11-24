import { NextRequest, NextResponse } from 'next/server';
import { communityChatEngine } from '@/lib/research/CommunityChatEngine';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol') || 'NVDA';
    const tag = searchParams.get('tag') || undefined;

    const transcript = communityChatEngine.getBufferedTranscript(symbol);
    const messages = communityChatEngine.getMessagesForSymbol(symbol, tag);

    return NextResponse.json({
      success: true,
      symbol,
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
    const { symbol, username, message, sentiment, badges } = body;

    if (!symbol || !message) {
      return NextResponse.json(
        { success: false, error: 'Both symbol and message are required' },
        { status: 400 }
      );
    }

    const dispatched = communityChatEngine.dispatchUserMessage({
      symbol,
      username: username || 'UserTrader',
      message,
      sentiment: sentiment || 'BULLISH',
      badges: badges || ['COMMUNITY'],
    });

    return NextResponse.json({
      success: true,
      message: dispatched,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to dispatch chat message' },
      { status: 500 }
    );
  }
}
