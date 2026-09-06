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
        {
          error:
            'Server configuration error. Missing Supabase environment variables.',
        },
        { status: 500 }
      );
    }

    // =========================================================
    // AUTHENTICATION
    // =========================================================

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

    // =========================================================
    // READ BODY
    // =========================================================

    const body = await req.json();

    const memberUserId =
      typeof body?.memberUserId === 'string'
        ? body.memberUserId.trim()
        : '';

    const restaurantId =
      typeof body?.restaurantId === 'string'
        ? body.restaurantId.trim()
        : '';

    const name =
      typeof body?.name === 'string'
        ? body.name.trim()
        : '';

    if (!memberUserId || !restaurantId || !name) {
      return NextResponse.json(
        {
          error: 'Name, member user ID and restaurant ID are required.',
        },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        {
          error: 'Name must be 100 characters or less.',
        },
        { status: 400 }
      );
    }

    // =========================================================
    // ADMIN CLIENT
    // =========================================================

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

    // =========================================================
    // VERIFY REQUESTER MEMBERSHIP
    // =========================================================

    const {
      data: requester,
      error: requesterError,
    } = await supabaseAdmin
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
            'You do not have permission to update team members.',
        },
        { status: 403 }
      );
    }

    // =========================================================
    // VERIFY TARGET MEMBER BELONGS TO RESTAURANT
    // =========================================================

    const {
      data: targetMember,
      error: targetError,
    } = await supabaseAdmin
      .from('restaurant_members')
      .select('user_id, role')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', memberUserId)
      .single();

    if (targetError || !targetMember) {
      return NextResponse.json(
        {
          error:
            'The selected team member does not belong to this restaurant.',
        },
        { status: 404 }
      );
    }

    if (targetMember.role?.toLowerCase().trim() === 'owner') {
      return NextResponse.json(
        { error: 'The restaurant owner account cannot be edited from Team Management.' },
        { status: 403 }
      );
    }

    // =========================================================
    // UPDATE AUTH USER NAME
    // =========================================================

    const {
      data: updatedUser,
      error: updateError,
    } =
      await supabaseAdmin.auth.admin.updateUserById(
        memberUserId,
        {
          user_metadata: {
            full_name: name,
            name: name,
          },
        }
      );

    if (updateError || !updatedUser.user) {
      return NextResponse.json(
        {
          error:
            updateError?.message ||
            'Failed to update team member name.',
        },
        { status: 400 }
      );
    }

    // =========================================================
    // SUCCESS
    // =========================================================

    return NextResponse.json({
      success: true,
      userId: memberUserId,
      name,
    });

  } catch (error: any) {
    console.error(
      'UPDATE TEAM MEMBER NAME ERROR:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Internal server error.',
      },
      { status: 500 }
    );
  }
}