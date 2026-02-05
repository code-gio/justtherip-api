export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Justtherip API',
    version: '1.0.0',
    description: 'API with Express, Swagger, and cron jobs',
  },
  servers: [{ url: '/v1', description: 'API base path (no /api when host is api.domain.com)' }],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns service health and timestamp',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'timestamp'],
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  tags: [{ name: 'Health', description: 'Health check endpoints' }],
} as const;
