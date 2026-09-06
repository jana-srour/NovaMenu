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

    const name =
      typeof body?.name === 'string'
        ? body.name.trim()
        : '';

    if (!restaurantId || !name) {
      return NextResponse.json(
        { error: 'Position name is required.' },
        { status: 400 }
      );
    }

    if (name.length > 50) {
      return NextResponse.json(
        { error: 'Position name must be 50 characters or less.' },
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

    // Only OWNER can manage positions
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

    // Prevent duplicate position names
    const {
      data: existingPosition,
    } = await supabaseAdmin
      .from('restaurant_roles')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .ilike('name', name)
      .maybeSingle();

    if (existingPosition) {
      return NextResponse.json(
        {
          error: 'A position with this name already exists.'
        },
        { status: 400 }
      );
    }

    const {
      data: position,
      error: insertError,
    } = await supabaseAdmin
      .from('restaurant_roles')
      .insert({
        restaurant_id: restaurantId,
        name,
      })
      .select()
      .single();

    if (insertError || !position) {
      return NextResponse.json(
        {
          error:
            insertError?.message ||
            'Failed to create position.'
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      position,
    });

  } catch (error: any) {
    console.error('ADD POSITION ERROR:', error);

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