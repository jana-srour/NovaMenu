import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { canManageTeam } from '@/lib/team-permissions';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
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

    const accessToken = authHeader.substring(7);

    const supabaseAuth = createClient(
      supabaseUrl,
      anonKey
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

    const body = await req.json();

    const restaurantId =
      typeof body?.restaurantId === 'string'
        ? body.restaurantId.trim()
        : '';

    const positionId =
      typeof body?.positionId === 'string'
        ? body.positionId.trim()
        : '';

    if (!restaurantId || !positionId) {
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

    // Only OWNER
    const {
      data: requester,
      error: requesterError,
    } = await supabaseAdmin
      .from('restaurant_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurantId)
      .single();

    if (requesterError || !requester || !await canManageTeam(supabaseAdmin, user.id, restaurantId)) {
      return NextResponse.json(
        {
          error: 'You do not have permission to manage team positions.'
        },
        { status: 403 }
      );
    }

    // Check whether position exists
    const {
      data: position,
      error: positionError,
    } = await supabaseAdmin
      .from('restaurant_roles')
      .select('id, name')
      .eq('id', positionId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (positionError || !position) {
      return NextResponse.json(
        {
          error: 'Position not found.'
        },
        { status: 404 }
      );
    }

    // Check whether any members currently use it
    const {
      count,
      error: memberError,
    } = await supabaseAdmin
      .from('restaurant_members')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('restaurant_id', restaurantId)
      .eq('position_id', positionId);

    if (memberError) {
      return NextResponse.json(
        {
          error: memberError.message
        },
        { status: 400 }
      );
    }

    if ((count || 0) > 0) {
      return NextResponse.json(
        {
          error:
            `Cannot delete "${position.name}" because ${count} team member${count === 1 ? ' is' : 's are'} currently assigned to it. Reassign them first.`
        },
        { status: 400 }
      );
    }

    const {
      error: deleteError,
    } = await supabaseAdmin
      .from('restaurant_roles')
      .delete()
      .eq('id', positionId)
      .eq('restaurant_id', restaurantId);

    if (deleteError) {
      return NextResponse.json(
        {
          error: deleteError.message
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Position removed successfully.'
    });

  } catch (error: any) {
    console.error('REMOVE POSITION ERROR:', error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Internal server error.'
      },
      { status: 500 }
    );
  }
}