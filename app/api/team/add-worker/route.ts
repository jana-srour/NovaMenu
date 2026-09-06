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

    const name =
      typeof body?.name === 'string'
        ? body.name.trim()
        : '';

    const email =
      typeof body?.email === 'string'
        ? body.email.trim()
        : '';

    const password =
      typeof body?.password === 'string'
        ? body.password
        : '';

    const role =
      typeof body?.role === 'string'
        ? body.role.trim()
        : '';

    const restaurantId =
      typeof body?.restaurantId === 'string'
        ? body.restaurantId.trim()
        : '';

    // =========================================================
    // VALIDATION
    // =========================================================

    if (
      !name ||
      !email ||
      !password ||
      !role ||
      !restaurantId
    ) {
      return NextResponse.json(
        {
          error: 'Missing required fields.',
          debug: {
            name: !!name,
            email: !!email,
            password: !!password,
            role: !!role,
            restaurantId: !!restaurantId,
          },
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          error:
            'Password must be at least 6 characters.',
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
    // VERIFY REQUESTER
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
            'You do not have permission to add team members.',
        },
        { status: 403 }
      );
    }

    // =========================================================
    // VERIFY POSITION
    // =========================================================

    const {
      data: position,
      error: positionError,
    } = await supabaseAdmin
      .from('restaurant_roles')
      .select('id, name')
      .eq('restaurant_id', restaurantId)
      .eq('name', role)
      .single();

    if (positionError || !position) {
      return NextResponse.json(
        {
          error:
            'The selected team position does not exist for this restaurant.',
        },
        { status: 400 }
      );
    }

    // =========================================================
    // CREATE AUTH USER
    // =========================================================

    const {
      data: authData,
      error: authError,
    } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,

        // SAVE NAME IN AUTH METADATA
        user_metadata: {
          full_name: name,
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error:
            authError?.message ||
            'Failed to create team member account.',
        },
        { status: 400 }
      );
    }

    const newUserId = authData.user.id;

    // =========================================================
    // ADD MEMBER
    // =========================================================

    const {
      error: memberError,
    } = await supabaseAdmin
      .from('restaurant_members')
      .insert({
        restaurant_id: restaurantId,
        user_id: newUserId,
        role: 'staff',
      });

    if (memberError) {
      console.error(
        'MEMBER INSERT FAILED:',
        memberError
      );

      await supabaseAdmin.auth.admin.deleteUser(
        newUserId
      );

      return NextResponse.json(
        {
          error: memberError.message,
        },
        { status: 400 }
      );
    }

    // =========================================================
    // SAVE POSITION
    // =========================================================

    const {
      error: positionMemberError,
    } = await supabaseAdmin
      .from('restaurant_members')
      .update({
        position_id: position.id,
      })
      .eq('restaurant_id', restaurantId)
      .eq('user_id', newUserId);

    if (positionMemberError) {
      console.error(
        'POSITION ASSIGNMENT FAILED:',
        positionMemberError
      );

      await supabaseAdmin
        .from('restaurant_members')
        .delete()
        .eq('restaurant_id', restaurantId)
        .eq('user_id', newUserId);

      await supabaseAdmin.auth.admin.deleteUser(
        newUserId
      );

      return NextResponse.json(
        {
          error:
            'Account was created but the restaurant position could not be assigned: ' +
            positionMemberError.message,
        },
        { status: 400 }
      );
    }

    // =========================================================
    // SUCCESS
    // =========================================================

    return NextResponse.json({
      success: true,
      userId: newUserId,
      name,
      positionId: position.id,
      positionName: position.name,
    });
  } catch (error: any) {
    console.error(
      'ADD WORKER ERROR:',
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