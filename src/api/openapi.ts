// OpenAPI docs and validator scaffolding (no generation yet)
import type { Application } from 'express';

export async function wireOpenAPIDocs(app: Application): Promise<void> {
  try {
    const swaggerUi = await import('swagger-ui-express');
    const { default: expressOpenApiValidator } = await import('express-openapi-validator');

    // Minimal spec placeholder; expand with real paths/schemas later
    const doc: any = {
      openapi: '3.0.0',
      info: { title: 'Universal AI Tools API', version: '1.0.0' },
      paths: {},
      components: { schemas: {} },
    };

    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(doc));

    app.use(
      expressOpenApiValidator({
        apiSpec: doc,
        validateRequests: false,
        validateResponses: false,
      }) as any
    );
  } catch {
    // Optional; skip when deps not installed
  }
}
