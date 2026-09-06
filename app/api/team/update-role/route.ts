import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { canManageTeam } from '@/lib/team-permissions';

export async function POST(req: Request) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // =========================================================
    // SERVER CONFIGURATION
    // =========================================================

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !anonKey
    ) {
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

    const authHeader =
      req.headers.get('authorization');

    if (
      !authHeader?.startsWith('Bearer ')
    ) {
      return NextResponse.json(
        {
          error: 'Unauthorized.',
        },
        { status: 401 }
      );
    }

    const accessToken =
      authHeader.substring(7);

    const supabaseAuth = createClient(
      supabaseUrl,
      anonKey
    );

    const {
      data: { user },
      error: userError,
    } =
      await supabaseAuth.auth.getUser(
        accessToken
      );

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            'Invalid or expired session.',
        },
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

    const role =
      typeof body?.role === 'string'
        ? body.role.trim()
        : '';

    /*
     * We accept positionId too, but the current Team page
     * sends the position NAME as "role".
     *
     * This keeps the current frontend working without
     * requiring you to change it.
     */

    const positionId =
      typeof body?.positionId === 'string'
        ? body.positionId.trim()
        : '';

    // =========================================================
    // VALIDATION
    // =========================================================

    if (
      !memberUserId ||
      !restaurantId ||
      (!role && !positionId)
    ) {
      return NextResponse.json(
        {
          error:
            'Missing required fields.',
          debug: {
            memberUserId:
              !!memberUserId,
            restaurantId:
              !!restaurantId,
            role:
              !!role,
            positionId:
              !!positionId,
          },
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
      data: requesterMembership,
      error: requesterError,
    } =
      await supabaseAdmin
        .from('restaurant_members')
        .select(
          'user_id, restaurant_id, role'
        )
        .eq(
          'user_id',
          user.id
        )
        .eq(
          'restaurant_id',
          restaurantId
        )
        .maybeSingle();

    if (
      requesterError ||
      !requesterMembership
    ) {
      return NextResponse.json(
        {
          error:
            'You are not a member of this restaurant.',
        },
        { status: 403 }
      );
    }

    // =========================================================
    // VERIFY REQUESTER ROLE
    // =========================================================

    const requesterRole =
      requesterMembership.role
        ?.toLowerCase()
        .trim();

    if (!await canManageTeam(supabaseAdmin, user.id, restaurantId)) {
      return NextResponse.json(
        {
          error:
            'You do not have permission to change team member positions.',
        },
        { status: 403 }
      );
    }

    // =========================================================
    // VERIFY TARGET MEMBER
    // =========================================================

    const {
      data: targetMember,
      error: targetMemberError,
    } =
      await supabaseAdmin
        .from('restaurant_members')
        .select(
          `
          user_id,
          restaurant_id,
          role,
          position_id
          `
        )
        .eq(
          'user_id',
          memberUserId
        )
        .eq(
          'restaurant_id',
          restaurantId
        )
        .maybeSingle();

    if (
      targetMemberError ||
      !targetMember
    ) {
      return NextResponse.json(
        {
          error:
            'The selected team member does not belong to this restaurant.',
        },
        { status: 404 }
      );
    }

    // =========================================================
    // PREVENT CHANGING OWNER / ADMIN ACCOUNT POSITION
    // =========================================================

    const targetRole =
      targetMember.role
        ?.toLowerCase()
        .trim();

    if (targetRole === 'owner') {
      return NextResponse.json(
        {
          error:
            'The restaurant owner account cannot have its position changed here.',
        },
        { status: 403 }
      );
    }

    // =========================================================
    // FIND POSITION
    // =========================================================

    let position: {
      id: string;
      restaurant_id: string;
      name: string;
    } | null = null;

    let positionError: any = null;

    // ---------------------------------------------------------
    // OPTION 1:
    // positionId was supplied
    // ---------------------------------------------------------

    if (positionId) {
      const result =
        await supabaseAdmin
          .from('restaurant_roles')
          .select(
            'id, restaurant_id, name'
          )
          .eq(
            'id',
            positionId
          )
          .eq(
            'restaurant_id',
            restaurantId
          )
          .maybeSingle();

      position =
        result.data;

      positionError =
        result.error;
    }

    // ---------------------------------------------------------
    // OPTION 2:
    // Current frontend sends position NAME as "role"
    // ---------------------------------------------------------

    if (!position && role) {
      const result =
        await supabaseAdmin
          .from('restaurant_roles')
          .select(
            'id, restaurant_id, name'
          )
          .eq(
            'restaurant_id',
            restaurantId
          )
          .eq(
            'name',
            role
          )
          .maybeSingle();

      position =
        result.data;

      positionError =
        result.error;
    }

    if (
      positionError
    ) {
      console.error(
        'POSITION LOOKUP ERROR:',
        positionError
      );

      return NextResponse.json(
        {
          error:
            positionError.message ||
            'Failed to find the selected team position.',
        },
        { status: 500 }
      );
    }

    if (!position) {
      return NextResponse.json(
        {
          error:
            'The selected team position does not exist for this restaurant.',
        },
        { status: 400 }
      );
    }

    // =========================================================
    // UPDATE POSITION_ID
    // =========================================================

    const {
      data: updatedMember,
      error: updateError,
    } =
      await supabaseAdmin
        .from('restaurant_members')
        .update({
          position_id:
            position.id,

          /*
           * IMPORTANT:
           *
           * Keep role as "staff".
           *
           * The actual restaurant position is stored
           * in position_id.
           */
          role: 'staff',
        })
        .eq(
          'user_id',
          memberUserId
        )
        .eq(
          'restaurant_id',
          restaurantId
        )
        .select(
          `
          user_id,
          restaurant_id,
          role,
          position_id
          `
        )
        .single();

    if (updateError) {
      console.error(
        'POSITION UPDATE FAILED:',
        updateError
      );

      return NextResponse.json(
        {
          error:
            updateError.message ||
            'Failed to update team member position.',
        },
        { status: 400 }
      );
    }

    // =========================================================
    // SUCCESS
    // =========================================================

    return NextResponse.json({
      success: true,

      userId:
        memberUserId,

      restaurantId,

      positionId:
        position.id,

      positionName:
        position.name,

      member:
        updatedMember,
    });
  } catch (error: any) {
    console.error(
      'UPDATE TEAM MEMBER POSITION ERROR:',
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