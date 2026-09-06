import type { SupabaseClient } from '@supabase/supabase-js';

export async function canManageTeam(
  supabaseAdmin: SupabaseClient,
  userId: string,
  restaurantId: string
) {
  const { data: membership } = await supabaseAdmin
    .from('restaurant_members')
    .select('role, position_id')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (!membership) {
    return false;
  }

  const role = membership.role?.toLowerCase().trim();
  if (role === 'owner' || role === 'admin') {
    return true;
  }

  if (!membership.position_id) {
    return false;
  }

  const { data: position } = await supabaseAdmin
    .from('restaurant_roles')
    .select('can_manage_team')
    .eq('id', membership.position_id)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  return position?.can_manage_team === true;
}