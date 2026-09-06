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

    const {
      memberUserId,
      restaurantId,
      password,
    } = await req.json();

    if (!memberUserId || !restaurantId || !password) {
      return NextResponse.json(
        { error: 'Missing required fields.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters.' },
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

    // Verify requester belongs to restaurant
    const { data: requester, error: requesterError } =
      await supabaseAdmin
        .from('restaurant_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('restaurant_id', restaurantId)
        .single();

    if (requesterError || !requester) {
      return NextResponse.json(
        {
          error:
            'You are not a member of this restaurant.',
        },
        { status: 403 }
      );
    }

    const requesterRole =
      requester.role?.toLowerCase().trim();

    if (!await canManageTeam(supabaseAdmin, user.id, restaurantId)) {
      return NextResponse.json(
        {
          error:
            'You do not have permission to reset team passwords.',
        },
        { status: 403 }
      );
    }

    // Make sure target member belongs to this restaurant
    const { data: targetMember, error: targetError } =
      await supabaseAdmin
        .from('restaurant_members')
        .select('user_id, role')
        .eq('user_id', memberUserId)
        .eq('restaurant_id', restaurantId)
        .single();

    if (targetError || !targetMember) {
      return NextResponse.json(
        {
          error:
            'Team member does not belong to this restaurant.',
        },
        { status: 404 }
      );
    }

    // Never allow changing the owner's password from here
    if (
      targetMember.role?.toLowerCase().trim() ===
      'owner'
    ) {
      return NextResponse.json(
        {
          error:
            'The restaurant owner account cannot be reset from Team Management.',
        },
        { status: 403 }
      );
    }

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(
        memberUserId,
        {
          password,
        }
      );

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
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