import express from 'express';
import request from 'supertest';

import { mountGraphQL } from '../../src/graphql/server';

describe('GraphQL Server', () => {
  test('POST /graphql { health } should return ok', async () => {
    const app = express();
    app.use(express.json());

    await mountGraphQL(app);

    const response = await request(app)
      .post('/graphql')
      .send({ query: '{ health }' })
      .set('Content-Type', 'application/json')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('health', 'ok');
  });
});
