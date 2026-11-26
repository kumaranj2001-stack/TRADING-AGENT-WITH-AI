import { NextRequest, NextResponse } from 'next/server';
import { cryptoOnChainEngine } from '@/lib/institutional/CryptoOnChainEngine';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asset = searchParams.get('asset') || searchParams.get('symbol') || 'BTC/USD';
  const sqlQuery = searchParams.get('sqlQuery') || undefined;

  return NextResponse.json({
    success: true,
    data: cryptoOnChainEngine.getSnapshot({ asset, sqlQuery }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.action === 'RUN_SQL') {
      const sqlQueryResult = cryptoOnChainEngine.executeDecodedLogsSql(String(body.sqlQuery || ''));
      return NextResponse.json({ success: true, sqlQueryResult });
    }
    return NextResponse.json({
      success: true,
      data: cryptoOnChainEngine.getSnapshot({
        asset: body?.asset || body?.symbol || 'BTC/USD',
        sqlQuery: body?.sqlQuery,
      }),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Crypto on-chain error' }, { status: 400 });
  }
}
