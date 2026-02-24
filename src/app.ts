import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/configuration.js';
import routes from './routes/index.js';
import { requestId, errorHandler, notFound } from './middleware/index.js';
import { openApiSpec } from '../swagger/openapi.js';
import { stripeWebhook } from './controllers/stripe/webhook.controller.js';

const app = express();

app.use(cors());
app.use(requestId);

// Stripe webhook must receive raw body for signature verification
app.use(
  config.apiBasePath + '/stripe/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhook
);

app.use(express.json());
app.use(config.apiBasePath, routes);

if (config.swagger.enabled) {
  app.get(`${config.swagger.path}/json`, (_req, res) => {
    res.json(openApiSpec);
  });
  app.use(config.swagger.path, swaggerUi.serve, swaggerUi.setup(openApiSpec));
}

app.use(notFound);
app.use(errorHandler);

export default app;
