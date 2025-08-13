export async function wireOpenAPIDocs(app) {
    try {
        const swaggerUi = await import('swagger-ui-express');
        const { default: expressOpenApiValidator } = await import('express-openapi-validator');
        const doc = {
            openapi: '3.0.0',
            info: { title: 'Universal AI Tools API', version: '1.0.0' },
            paths: {},
            components: { schemas: {} },
        };
        app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(doc));
        app.use(expressOpenApiValidator({
            apiSpec: doc,
            validateRequests: false,
            validateResponses: false,
        }));
    }
    catch {
    }
}
//# sourceMappingURL=openapi.js.map