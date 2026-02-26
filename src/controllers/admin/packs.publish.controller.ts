import type { Request, Response, NextFunction } from 'express';
import { publishAdminPack } from '../../services/admin-packs.service.js';

/**
 * POST /v1/admin/packs/:id/publish
 * Publish pack: save and set is_active = true.
 */
export async function publishAdminPackHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const packId = req.params.id;
    const body = req.body ?? {};
    if (!packId) {
      res.status(400).json({ error: 'Pack id is required' });
      return;
    }
    const { name, slug, description, image_url, game_code, rip_cost, pack_cards } = body;
    if (!name || !slug || !game_code) {
      res.status(400).json({
        error: 'Missing required fields: name, slug, game_code',
      });
      return;
    }
    await publishAdminPack(packId, {
      name,
      slug,
      description: description ?? null,
      image_url: image_url ?? null,
      game_code,
      rip_cost: Number(rip_cost) || 1,
      pack_cards: Array.isArray(pack_cards) ? pack_cards : [],
    });
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}
