/**
 * Auto-toggle external integrations based on environment and network reachability.
 * - Sets DISABLE_EXTERNAL_CALLS=true if network checks fail
 * - Sets OFFLINE_MODE=true if no internet and no DNS resolution
 */
import { execSync } from 'node:child_process';
import dns from 'node:dns/promises';

async function hasInternet(): Promise<boolean> {
  try {
    await dns.lookup('www.google.com');
    return true;
  } catch {
    return false;
  }
}

function canCurl(url: string): boolean {
  try {
    execSync(`curl -sSf --max-time 2 ${url} > /dev/null`);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const internet = await hasInternet();
  const hfOk = canCurl('https://huggingface.co');

  const recommended = {
    OFFLINE_MODE: (!internet).toString(),
    DISABLE_EXTERNAL_CALLS: (!hfOk || !internet).toString(),
  };

  // Output as shell exports so CI or shell can eval
  const lines = Object.entries(recommended).map(([k, v]) => `export ${k}=${v}`);
  console.log(lines.join('\n'));
}

main().catch(() => process.exit(0));
