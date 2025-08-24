import { verifiedFactsService } from './verified-facts-service';
import { webSearchService } from './web-search-service';

let timer: NodeJS.Timeout | null = null;

export function startFactsValidator(intervalMs = 10 * 60 * 1000): void {
  if (timer) {return;}
  timer = setInterval(async () => {
    try {
      // This is a stub: we don't have list-all; pick a known question to probe if any
      // In a full implementation, add a list endpoint or maintain a small MRU cache
      const probe = await verifiedFactsService.findFact('Who invented TCP/IP?');
      if (!probe) {return;}
      const hits = (await webSearchService.searchDuckDuckGo(probe.question, 3)).concat(
        await webSearchService.searchWikipedia(probe.question, 3)
      );
      if (hits.length === 0) {
      }
      // Very basic re-affirmation: keep as is. In future, mark stale/conflicting.
    } catch {
      // ignore
    }
  }, intervalMs);
}

export function stopFactsValidator(): void {
  if (timer) {clearInterval(timer);}
  timer = null;
}
