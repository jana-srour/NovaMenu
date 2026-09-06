import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { canManageTeam } from '@/lib/team-permissions';

export async function GET(req: Request) {
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

    const accessToken = authHeader.replace('Bearer ', '');

    // Verify logged-in user
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

    // Admin client
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

    // Find restaurant membership
    const { data: membership, error: membershipError } =
      await supabaseAdmin
        .from('restaurant_members')
        .select('restaurant_id, role')
        .eq('user_id', user.id)
        .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'You are not a member of a restaurant.' },
        { status: 403 }
      );
    }

    const requesterRole =
      membership.role?.toLowerCase().trim();

    if (!await canManageTeam(supabaseAdmin, user.id, membership.restaurant_id)) {
      return NextResponse.json(
        {
          error:
            'You do not have permission to manage positions.',
        },
        { status: 403 }
      );
    }

    const { data: positions, error: positionsError } =
      await supabaseAdmin
        .from('restaurant_roles')
        .select('*')
        .eq('restaurant_id', membership.restaurant_id)
        .order('created_at', { ascending: true });

    if (positionsError) {
      return NextResponse.json(
        { error: positionsError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      restaurantId: membership.restaurant_id,
      positions: positions || [],
    });

  } catch (err: any) {
    return NextResponse.json(
      {
        error:
          err.message ||
          'Internal Server Error.',
      },
      { status: 500 }
    );
  }
}


// ============================================================
// ADD POSITION
// ============================================================

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

    const accessToken = authHeader.replace('Bearer ', '');

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

    const name =
      typeof body.name === 'string'
        ? body.name.trim()
        : '';

    if (!name) {
      return NextResponse.json(
        { error: 'Position name is required.' },
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

    // Find restaurant + verify owner/admin
    const { data: membership, error: membershipError } =
      await supabaseAdmin
        .from('restaurant_members')
        .select('restaurant_id, role')
        .eq('user_id', user.id)
        .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'You are not a member of a restaurant.' },
        { status: 403 }
      );
    }

    const requesterRole =
      membership.role?.toLowerCase().trim();

    if (!await canManageTeam(supabaseAdmin, user.id, membership.restaurant_id)) {
      return NextResponse.json(
        {
          error:
            'You do not have permission to manage positions.',
        },
        { status: 403 }
      );
    }

    // Prevent duplicate position names
    const { data: existingPosition } =
      await supabaseAdmin
        .from('restaurant_roles')
        .select('id')
        .eq('restaurant_id', membership.restaurant_id)
        .ilike('name', name)
        .maybeSingle();

    if (existingPosition) {
      return NextResponse.json(
        { error: 'This position already exists.' },
        { status: 400 }
      );
    }

    const { data: position, error: insertError } =
      await supabaseAdmin
        .from('restaurant_roles')
        .insert({
          restaurant_id: membership.restaurant_id,
          name,
        })
        .select()
        .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      position,
    });

  } catch (err: any) {
    return NextResponse.json(
      {
        error:
          err.message ||
          'Internal Server Error.',
      },
      { status: 500 }
    );
  }
}