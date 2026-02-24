import type { Request, Response, NextFunction } from 'express';
import { config } from '../../config/configuration.js';
import { updateMtgCards } from '../../services/mtg-cards.service.js';

/**
 * Protects cron endpoint: requires CRON_API_SECRET in header or query.
 */
export function requireCronSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = config.cronApiSecret;
  if (!secret) {
    next();
    return;
  }
  const provided = req.headers['x-cron-secret'] ?? req.query.secret;
  if (provided !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

export async function runUpdateMtgCards(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await updateMtgCards();
    if (!result.success) {
      res.status(500).json({ success: false, error: result.error, message: result.message });
      return;
    }
    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        downloadUri: result.defaultCardsData?.download_uri,
        updatedAt: result.defaultCardsData?.updated_at,
        size: result.defaultCardsData?.size,
        contentType: result.defaultCardsData?.content_type,
        cardsDataFetched: result.cardsDataFetched,
        cardsCount: result.cardsCount,
        cardsProcessed: result.cardsProcessed,
        batchesProcessed: result.batchesProcessed,
        newCards: result.newCards,
        updatedCards: result.updatedCards,
        errorCards: result.errorCards,
      },
    });
  } catch (err) {
    next(err);
  }
}
