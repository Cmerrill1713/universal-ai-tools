import { verifiedFactsService } from './verified-facts-service';
import { webSearchService } from './web-search-service';
let timer = null;
export function startFactsValidator(intervalMs = 10 * 60 * 1000) {
    if (timer)
        return;
    timer = setInterval(async () => {
        try {
            const probe = await verifiedFactsService.findFact('Who invented TCP/IP?');
            if (!probe)
                return;
            const hits = (await webSearchService.searchDuckDuckGo(probe.question, 3)).concat(await webSearchService.searchWikipedia(probe.question, 3));
            if (hits.length === 0) {
            }
        }
        catch {
        }
    }, intervalMs);
}
export function stopFactsValidator() {
    if (timer)
        clearInterval(timer);
    timer = null;
}
//# sourceMappingURL=verified-facts-validator.js.map