import type { Request, Response, NextFunction } from 'express';
import { getLandingData } from '../../services/landing.service.js';

const MAX_TOP_PACKS = 10;
const MAX_RECENT_PULLS = 50;
const MAX_RARE_PULLS = 25;
const MAX_MYTHIC_PULLS = 25;
const MAX_TOP_CARDS_PER_PACK = 5;

function parsePositiveInt(value: unknown, defaultVal: number, max: number): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  if (!Number.isFinite(n) || n < 1) return defaultVal;
  return Math.min(n, max);
}

/**
 * GET /v1/public/landing
 * Public endpoint: returns games, topPacks, recentPulls, rarePulls, packsByGame for the landing page.
 * No authentication required.
 */
export async function getLanding(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // console.log('req.query', req.query);
    // console.log('req.query.topPacksLimit', req.query.topPacksLimit);
    // console.log('req.query.recentPullsLimit', req.query.recentPullsLimit);
    // console.log('req.query.rarePullsLimit', req.query.rarePullsLimit);
    // console.log('req.query.topCardsPerPack', req.query.topCardsPerPack);
    const topPacksLimit = parsePositiveInt(req.query.topPacksLimit, 4, MAX_TOP_PACKS);
    const recentPullsLimit = parsePositiveInt(req.query.recentPullsLimit, 20, MAX_RECENT_PULLS);
    const rarePullsLimit = parsePositiveInt(req.query.rarePullsLimit, 20, MAX_RARE_PULLS);
    const mythicPullsLimit = parsePositiveInt(req.query.mythicPullsLimit, 25, MAX_MYTHIC_PULLS);
    const topCardsPerPack = parsePositiveInt(req.query.topCardsPerPack, 3, MAX_TOP_CARDS_PER_PACK);
    // console.log('topPacksLimit', topPacksLimit);
    // console.log('recentPullsLimit', recentPullsLimit);
    // console.log('rarePullsLimit', rarePullsLimit);
    // console.log('topCardsPerPack', topCardsPerPack);


    const data = await getLandingData({
      topPacksLimit,
      recentPullsLimit,
      rarePullsLimit,
      mythicPullsLimit,
      topCardsPerPack,
    });

    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}
