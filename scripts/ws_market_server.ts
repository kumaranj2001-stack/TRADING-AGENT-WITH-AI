/**
 * scripts/ws_market_server.ts
 * Standalone High-Frequency Node.js WebSocket Server (ws://localhost:3001)
 * Run optionally alongside `npm run dev` for dedicated binary/JSON WebSocket streaming.
 */

import { highFrequencyWsServer } from '../lib/chartjs/HighFrequencyWsServer';

async function main() {
  const started = await highFrequencyWsServer.ensureStarted();
  if (started) {
    console.log(`🚀 QuriTrader High-Frequency WebSocket Server active on ws://localhost:${highFrequencyWsServer.getPort()}`);
  } else {
    console.error('❌ Failed to bind WebSocket server port.');
    process.exit(1);
  }
}

main();
