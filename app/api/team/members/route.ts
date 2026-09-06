import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    // =========================================================
    // ENVIRONMENT VARIABLES
    // =========================================================

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
    // FIND REQUESTER RESTAURANT
    // =========================================================
    //
    // We get the restaurant through restaurant_members.
    //
    // =========================================================

    const {
      data: requesterMembership,
      error: requesterError,
    } =
      await supabaseAdmin
        .from('restaurant_members')
        .select(
          'restaurant_id, role'
        )
        .eq(
          'user_id',
          user.id
        )
        .limit(1)
        .maybeSingle();

    if (
      requesterError ||
      !requesterMembership
    ) {
      console.error(
        'REQUESTER MEMBERSHIP ERROR:',
        requesterError
      );

      return NextResponse.json(
        {
          error:
            'No restaurant membership found.',
        },
        { status: 403 }
      );
    }

    const restaurantId =
      requesterMembership.restaurant_id;

    // =========================================================
    // GET RESTAURANT MEMBERS
    // =========================================================

    const {
      data: memberships,
      error: membershipError,
    } =
      await supabaseAdmin
        .from('restaurant_members')
        .select(
          `
          user_id,
          role,
          position_id,
          created_at
          `
        )
        .eq(
          'restaurant_id',
          restaurantId
        )
        .order(
          'created_at',
          {
            ascending: true,
          }
        );

    if (membershipError) {
      console.error(
        'MEMBERSHIP LOAD ERROR:',
        membershipError
      );

      return NextResponse.json(
        {
          error:
            membershipError.message,
        },
        { status: 500 }
      );
    }

    // =========================================================
    // GET AUTH USERS
    // =========================================================

    const {
      data: usersData,
      error: usersError,
    } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (usersError) {
      console.error(
        'AUTH USERS LOAD ERROR:',
        usersError
      );

      return NextResponse.json(
        {
          error:
            usersError.message,
        },
        { status: 500 }
      );
    }

    // =========================================================
    // GET RESTAURANT POSITIONS
    // =========================================================

    const {
      data: positions,
      error: positionsError,
    } =
      await supabaseAdmin
        .from('restaurant_roles')
        .select(
          'id, name'
        )
        .eq(
          'restaurant_id',
          restaurantId
        );

    if (positionsError) {
      console.error(
        'POSITIONS LOAD ERROR:',
        positionsError
      );

      return NextResponse.json(
        {
          error:
            positionsError.message,
        },
        { status: 500 }
      );
    }

    // =========================================================
    // BUILD TEAM LIST
    // =========================================================

    const members =
      (memberships || []).map(
        (membership) => {

          // -----------------------------------------------------
          // FIND AUTH USER
          // -----------------------------------------------------

          const authUser =
            usersData.users.find(
              (u) =>
                u.id ===
                membership.user_id
            );

          // -----------------------------------------------------
          // FIND RESTAURANT POSITION
          // -----------------------------------------------------

          const position =
            (positions || []).find(
              (p) =>
                p.id ===
                membership.position_id
            );

          // -----------------------------------------------------
          // GET NAME
          // -----------------------------------------------------
          //
          // Names are stored in:
          //
          // auth.users.raw_user_meta_data
          //
          // using:
          //
          // user_metadata.full_name
          //
          // -----------------------------------------------------

          const fullName =
            typeof authUser
              ?.user_metadata
              ?.full_name === 'string'
              ? authUser.user_metadata.full_name.trim()
              : '';

          // -----------------------------------------------------
          // GET EMAIL
          // -----------------------------------------------------

          const email =
            authUser?.email || '';

          // -----------------------------------------------------
          // GET POSITION NAME
          // -----------------------------------------------------

          const positionName =
            position?.name ||
            membership.role ||
            'Staff';

          // -----------------------------------------------------
          // RETURN MEMBER
          // -----------------------------------------------------

          return {
            user_id:
              membership.user_id,

            email,

            name:
              fullName,

            role:
              positionName,

            created_at:
              membership.created_at,
          };
        }
      );

    // =========================================================
    // SUCCESS
    // =========================================================

    return NextResponse.json({
      success: true,
      restaurantId,
      members,
    });

  } catch (error: any) {

    console.error(
      'GET TEAM MEMBERS ERROR:',
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