import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const VALID_SORT_FIELDS = ['requested_at', 'status', 'card_value_cents', 'created_at'];

export async function listAdminShipments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    const statusFilter = req.query.status as string | undefined;
    const userIdFilter = req.query.user_id as string | undefined;
    const searchQuery = (req.query.search as string)?.trim() ?? '';
    const sortField = (req.query.sort as string) || 'requested_at';
    const sortOrder = req.query.order === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(req.query.limit), 10) || DEFAULT_LIMIT));
    const offset = (page - 1) * limit;

    let query = admin
      .from('shipments')
      .select('*, user_inventory!shipments_inventory_card_id_fkey (*)', { count: 'exact' })
      .order('requested_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (userIdFilter) query = query.eq('user_id', userIdFilter);
    if (searchQuery) query = query.or(`card_name.ilike.%${searchQuery}%,tracking_number.ilike.%${searchQuery}%`);

    const sortBy = VALID_SORT_FIELDS.includes(sortField) ? sortField : 'requested_at';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data: shipments, error, count } = await query;
    if (error) {
      res.status(500).json({ error: 'Failed to fetch shipments' });
      return;
    }

    const userIds = [...new Set((shipments ?? []).map((s: { user_id: string }) => s.user_id))];
    const profilesMap = new Map<string, { email?: string; display_name?: string; username?: string }>();
    if (userIds.length > 0) {
      const { data: profiles } = await admin.from('profiles').select('id, email, username, display_name').in('id', userIds);
      (profiles ?? []).forEach((p: { id: string; email?: string; display_name?: string; username?: string }) => profilesMap.set(p.id, p));
    }

    const transformed = (shipments ?? []).map((s: Record<string, unknown>) => {
      const profile = profilesMap.get(s.user_id as string) ?? {};
      return {
        id: s.id,
        userId: s.user_id,
        userEmail: profile.email,
        userName: profile.display_name ?? profile.username,
        cardName: s.card_name,
        cardTier: s.card_tier_name,
        cardTierName: s.card_tier_name,
        cardValue: `$${((s.card_value_cents as number) / 100).toFixed(2)}`,
        cardImage: s.card_image_url,
        status: s.status,
        requestDate: s.requested_at ? new Date(s.requested_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
        requestedAt: s.requested_at,
        trackingNumber: s.tracking_number,
        carrier: s.carrier,
        estimatedDelivery: s.estimated_delivery_date ? new Date(s.estimated_delivery_date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
        deliveredDate: s.delivered_date ? new Date(s.delivered_date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
        shippingAddress: s.shipping_address_full,
        shippingName: s.shipping_name,
        shippingPhone: s.shipping_phone,
        adminNotes: s.admin_notes,
        processedAt: s.processed_at,
        shippedAt: s.shipped_at,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        inventory: s.user_inventory,
      };
    });

    let filtered = transformed;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = transformed.filter((s) => {
        const name = String(s.cardName ?? '');
        const tracking = String(s.trackingNumber ?? '');
        const email = String(s.userEmail ?? '');
        return name.toLowerCase().includes(q) || tracking.toLowerCase().includes(q) || email.toLowerCase().includes(q);
      });
    }

    res.status(200).json({ shipments: filtered, total: count ?? 0, page, limit, hasMore: (count ?? 0) > offset + limit });
  } catch (err) {
    next(err);
  }
}
