export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Justtherip API',
    version: '1.0.0',
    description: 'API with Express, Swagger, and cron jobs',
  },
  servers: [{ url: '/v1', description: 'API base path' }],
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
    '/rips/balance': {
      get: {
        tags: ['Rips'],
        summary: 'Get user Rip balance',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Balance and user_id' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/rips/bundles': {
      get: {
        tags: ['Rips'],
        summary: 'List active Rip bundles',
        responses: { '200': { description: 'List of bundles' } },
      },
    },
    '/cards/search': {
      post: {
        tags: ['Cards'],
        summary: 'Search cards',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { table: { type: 'string' }, query: { type: 'string' }, limit: { type: 'number' } } } } } },
        responses: { '200': { description: 'Cards list' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/cards/bulk-verify': {
      post: {
        tags: ['Cards'],
        summary: 'Bulk verify card names',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Found and notFound arrays' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/packs': {
      get: {
        tags: ['Packs'],
        summary: 'List active packs for purchase',
        description: 'Returns published packs with top 3 cards each. If Authorization header is sent, also returns the user Rip balance.',
        security: [],
        parameters: [{ in: 'header', name: 'Authorization', description: 'Optional. Bearer token to include balance in response', schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'packs: array of { id, name, image, price, game_code, topCards }. balance: number (only if authenticated)',
          },
        },
      },
    },
    '/packs/{id}': {
      get: {
        tags: ['Packs'],
        summary: 'Get pack detail by ID',
        description: 'Returns pack with all cards, probabilities, floor/ev/ceiling, topCards. If authenticated, also returns balance and sellbackRate.',
        security: [],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' }, description: 'Pack UUID' },
          { in: 'header', name: 'Authorization', description: 'Optional. Bearer token for balance + sellbackRate', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'pack, balance (if auth), sellbackRate' },
          '404': { description: 'Pack not found' },
        },
      },
    },
    '/packs/open': {
      post: {
        tags: ['Packs'],
        summary: 'Open a pack',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['pack_id'], properties: { pack_id: { type: 'string' } } } } } },
        responses: { '200': { description: 'Drawn card and new balance' }, '400': { description: 'Insufficient Rips or invalid pack' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/inventory': {
      get: {
        tags: ['Inventory'],
        summary: 'List user inventory',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'query', name: 'page', schema: { type: 'integer' } }, { in: 'query', name: 'limit', schema: { type: 'integer' } }],
        responses: { '200': { description: 'Cards and stats' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/inventory/sell': {
      post: {
        tags: ['Inventory'],
        summary: 'Sell a card for Rips',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['card_id'], properties: { card_id: { type: 'string' } } } } } },
        responses: { '200': { description: 'Rips credited' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/inventory/ship': {
      post: {
        tags: ['Inventory'],
        summary: 'Request shipment for a card',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['card_id'], properties: { card_id: { type: 'string' }, shipping_address_id: { type: 'string' } } } } } },
        responses: { '200': { description: 'Shipment created' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/shipments': {
      get: {
        tags: ['Shipments'],
        summary: 'List user shipments',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'query', name: 'status', schema: { type: 'string' } }],
        responses: { '200': { description: 'Shipments list' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/shipping-addresses': {
      get: {
        tags: ['Shipping Addresses'],
        summary: 'List shipping addresses',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Addresses list' }, '401': { description: 'Unauthorized' } },
      },
      post: {
        tags: ['Shipping Addresses'],
        summary: 'Create shipping address',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Created address' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/shipping-addresses/{id}': {
      get: { tags: ['Shipping Addresses'], summary: 'Get address', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Address' }, '404': { description: 'Not found' } } },
      patch: { tags: ['Shipping Addresses'], summary: 'Update address', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated address' }, '404': { description: 'Not found' } } },
      delete: { tags: ['Shipping Addresses'], summary: 'Delete address', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' }, '404': { description: 'Not found' } } },
    },
    '/stripe/create-checkout': {
      post: {
        tags: ['Stripe'],
        summary: 'Create Stripe checkout session',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['bundle_id'], properties: { bundle_id: { type: 'string', format: 'uuid' } } } } } },
        responses: { '200': { description: 'sessionId and url' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/stripe/webhook': {
      post: {
        tags: ['Stripe'],
        summary: 'Stripe webhook (no auth)',
        description: 'Called by Stripe; signature verified via stripe-signature header',
        responses: { '200': { description: 'Received' }, '400': { description: 'Invalid signature' } },
      },
    },
    '/media/folders': {
      get: { tags: ['Media'], summary: 'List folders', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'parentId', schema: { type: 'string' } }], responses: { '200': { description: 'Folders' }, '401': { description: 'Unauthorized' } } },
      post: { tags: ['Media'], summary: 'Create folder', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Created folder' }, '401': { description: 'Unauthorized' } } },
    },
    '/media/assets': {
      get: { tags: ['Media'], summary: 'List assets', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'folderId', schema: { type: 'string' } }], responses: { '200': { description: 'Assets' }, '401': { description: 'Unauthorized' } } },
    },
    '/media/assets/{id}': {
      get: { tags: ['Media'], summary: 'Get asset', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Asset' }, '404': { description: 'Not found' } } },
      delete: { tags: ['Media'], summary: 'Delete asset', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' }, '404': { description: 'Not found' } } },
    },
    '/media/upload': {
      post: { tags: ['Media'], summary: 'Upload file', security: [{ bearerAuth: [] }], requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, folderId: { type: 'string' } } } } } }, responses: { '200': { description: 'Asset' }, '401': { description: 'Unauthorized' } } },
    },
    '/media/count': {
      get: { tags: ['Media'], summary: 'Count assets in folder', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'folderId', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'count' }, '401': { description: 'Unauthorized' } } },
    },
    '/admin/shipments': {
      get: { tags: ['Admin'], summary: 'List all shipments (admin)', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'status', schema: { type: 'string' } }, { in: 'query', name: 'user_id', schema: { type: 'string' } }, { in: 'query', name: 'page', schema: { type: 'integer' } }, { in: 'query', name: 'limit', schema: { type: 'integer' } }], responses: { '200': { description: 'Shipments' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
    },
    '/admin/shipments/{id}': {
      patch: { tags: ['Admin'], summary: 'Update shipment (admin)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated shipment' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
    },
    '/admin/shipments/purchase-options': {
      get: { tags: ['Admin'], summary: 'Purchase options', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'game_code', schema: { type: 'string' } }, { in: 'query', name: 'card_name', schema: { type: 'string' } }], responses: { '200': { description: 'Purchase options' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
    },
    '/admin/cards/search': {
      get: { tags: ['Admin'], summary: 'Search cards (admin)', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'game_code', schema: { type: 'string' } }, { in: 'query', name: 'search', schema: { type: 'string' } }, { in: 'query', name: 'page', schema: { type: 'integer' } }], responses: { '200': { description: 'Cards' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
    },
    '/admin/packs/{packId}/probabilities': {
      get: { tags: ['Admin'], summary: 'Pack card probabilities', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'packId', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Probabilities' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
    },
    '/admin/simulator/packs/{packId}': {
      get: { tags: ['Admin'], summary: 'Simulator pack cards', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'packId', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Cards with probabilities' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
    },
    '/admin/users/{userId}/transactions': {
      get: { tags: ['Admin'], summary: 'User transactions', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Transactions' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
    },
    '/admin/system-config': {
      get: { tags: ['Admin'], summary: 'Get system config', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'key', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'value' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
      patch: { tags: ['Admin'], summary: 'Update system config', security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['key', 'value'], properties: { key: { type: 'string' }, value: {} } } } } }, responses: { '200': { description: 'Updated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
    },
    '/cron/update-mtg-cards': {
      get: {
        tags: ['Cron'],
        summary: 'Update MTG cards from Scryfall',
        description: 'Optional: send X-Cron-Secret or query param secret if CRON_API_SECRET is set',
        parameters: [{ in: 'header', name: 'X-Cron-Secret', schema: { type: 'string' } }, { in: 'query', name: 'secret', schema: { type: 'string' } }],
        responses: { '200': { description: 'Update result' }, '401': { description: 'Unauthorized if secret required and missing' } },
      },
    },
  },
  tags: [
    { name: 'Health', description: 'Health check' },
    { name: 'Rips', description: 'Rip balance and bundles' },
    { name: 'Cards', description: 'Card search and verify' },
    { name: 'Packs', description: 'Pack opening' },
    { name: 'Inventory', description: 'User inventory' },
    { name: 'Shipments', description: 'User shipments' },
    { name: 'Shipping Addresses', description: 'Shipping addresses' },
    { name: 'Stripe', description: 'Payments' },
    { name: 'Media', description: 'Media folders and assets' },
    { name: 'Admin', description: 'Admin-only endpoints' },
    { name: 'Cron', description: 'Cron-triggered jobs' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Supabase JWT' },
    },
  },
} as const;
