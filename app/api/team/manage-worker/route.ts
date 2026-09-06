import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { canManageTeam } from '@/lib/team-permissions';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error.' },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');

    const supabaseAuth = createClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session.' },
        { status: 401 }
      );
    }

    const {
      action,
      restaurantId,
      memberUserId,
      role,
      password,
    } = await req.json();

    if (!action || !restaurantId || !memberUserId) {
      return NextResponse.json(
        { error: 'Missing required fields.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check requester membership
    const { data: requester, error: requesterError } =
      await supabaseAdmin
        .from('restaurant_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('restaurant_id', restaurantId)
        .single();

    if (requesterError || !requester) {
      return NextResponse.json(
        { error: 'You are not a member of this restaurant.' },
        { status: 403 }
      );
    }

    const requesterRole = requester.role?.toLowerCase().trim();

    if (!await canManageTeam(supabaseAdmin, user.id, restaurantId)) {
      return NextResponse.json(
        { error: 'Only the owner or manager can manage team members.' },
        { status: 403 }
      );
    }

    // Get target member
    const { data: targetMember, error: targetError } =
      await supabaseAdmin
        .from('restaurant_members')
        .select('role')
        .eq('user_id', memberUserId)
        .eq('restaurant_id', restaurantId)
        .single();

    if (targetError || !targetMember) {
      return NextResponse.json(
        { error: 'Team member not found.' },
        { status: 404 }
      );
    }

    const targetRole = targetMember.role?.toLowerCase().trim();

    // Nobody can modify/delete the restaurant owner
    if (targetRole === 'owner') {
      return NextResponse.json(
        { error: 'The restaurant owner cannot be modified or removed.' },
        { status: 403 }
      );
    }

    // Managers cannot manage other managers
    // ---------------------------------------------------------
    // CHANGE ROLE
    // ---------------------------------------------------------

    if (action === 'change_role') {
      if (!role) {
        return NextResponse.json(
          { error: 'New role is required.' },
          { status: 400 }
        );
      }

      const { data: roleExists, error: roleError } =
        await supabaseAdmin
          .from('restaurant_roles')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('name', role)
          .maybeSingle();

      if (roleError || !roleExists) {
        return NextResponse.json(
          { error: 'This role does not exist for this restaurant.' },
          { status: 400 }
        );
      }

      const { error } = await supabaseAdmin
        .from('restaurant_members')
        .update({ role })
        .eq('user_id', memberUserId)
        .eq('restaurant_id', restaurantId);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Role updated successfully.',
      });
    }

    // ---------------------------------------------------------
    // RESET PASSWORD
    // ---------------------------------------------------------

    if (action === 'reset_password') {
      if (!password || password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters.' },
          { status: 400 }
        );
      }

      const { error } =
        await supabaseAdmin.auth.admin.updateUserById(
          memberUserId,
          { password }
        );

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Password reset successfully.',
      });
    }

    // ---------------------------------------------------------
    // DELETE MEMBER
    // ---------------------------------------------------------

    if (action === 'delete') {
      const { error: deleteError } =
        await supabaseAdmin.auth.admin.deleteUser(
          memberUserId
        );

      if (deleteError) {
        return NextResponse.json(
          { error: deleteError.message },
          { status: 400 }
        );
      }

      // Delete membership too
      await supabaseAdmin
        .from('restaurant_members')
        .delete()
        .eq('user_id', memberUserId)
        .eq('restaurant_id', restaurantId);

      return NextResponse.json({
        success: true,
        message: 'Team member removed successfully.',
      });
    }

    return NextResponse.json(
      { error: 'Unknown action.' },
      { status: 400 }
    );

  } catch (err: any) {
    console.error('TEAM MANAGEMENT ERROR:', err);

    return NextResponse.json(
      { error: err.message || 'Internal Server Error.' },
      { status: 500 }
    );
  }
}