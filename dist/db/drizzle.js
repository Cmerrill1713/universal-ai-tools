export async function getDrizzleClient(pool) {
    try {
        const { drizzle } = await import('drizzle-orm/node-postgres');
        return drizzle(pool);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=drizzle.js.map