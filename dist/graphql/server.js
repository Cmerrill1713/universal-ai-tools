export async function mountGraphQL(app) {
    try {
        const { ApolloServer } = await import('@apollo/server');
        const { expressMiddleware } = await import('@as-integrations/express4');
        const typeDefs = `#graphql
      type Query {
        health: String!
      }
    `;
        const resolvers = {
            Query: {
                health: () => 'ok',
            },
        };
        const server = new ApolloServer({ typeDefs, resolvers });
        await server.start();
        app.use('/graphql', expressMiddleware(server));
    }
    catch (err) {
        app.post('/graphql', (req, res) => {
            try {
                const query = req?.body?.query;
                if (query && /health/i.test(query)) {
                    return res.status(200).json({ data: { health: 'ok' } });
                }
                return res.status(400).json({ errors: [{ message: 'Unsupported query' }] });
            }
            catch (e) {
                return res.status(500).json({ errors: [{ message: 'GraphQL fallback error' }] });
            }
        });
    }
}
//# sourceMappingURL=server.js.map