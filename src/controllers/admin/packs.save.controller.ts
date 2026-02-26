import type { Request, Response, NextFunction } from 'express';
import { saveAdminPack } from '../../services/admin-packs.service.js';

/**
 * PUT /v1/admin/packs/:id
 * Save pack: update pack fields and replace pack_cards. Does not change is_active.
 */
export async function saveAdminPackHandler(
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
    await saveAdminPack(packId, {
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
