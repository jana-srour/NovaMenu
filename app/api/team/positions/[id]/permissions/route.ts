import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { canManageTeam } from '@/lib/team-permissions';

export async function GET(
  req: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
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
        { error: 'Server configuration error.' },
        { status: 500 }
      );
    }

    const authHeader =
      req.headers.get('authorization');

    if (
      !authHeader?.startsWith('Bearer ')
    ) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
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
        { error: 'Invalid or expired session.' },
        { status: 401 }
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

    const { id } = await context.params;

    const {
      data: position,
      error: positionError,
    } =
      await supabaseAdmin
        .from('restaurant_roles')
        .select('*')
        .eq('id', id)
        .single();

    if (
      positionError ||
      !position
    ) {
      return NextResponse.json(
        { error: 'Position not found.' },
        { status: 404 }
      );
    }

    const {
      data: membership,
      error: membershipError,
    } =
      await supabaseAdmin
        .from('restaurant_members')
        .select('role')
        .eq('user_id', user.id)
        .eq(
          'restaurant_id',
          position.restaurant_id
        )
        .single();

    if (
      membershipError ||
      !membership
    ) {
      return NextResponse.json(
        {
          error:
            'You are not a member of this restaurant.',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      permissions: {
        can_view_dashboard:
          Boolean(
            position.can_view_dashboard
          ),

        can_manage_menu:
          Boolean(
            position.can_manage_menu
          ),

        can_manage_pricing:
          Boolean(
            position.can_manage_pricing
          ),

        can_manage_orders:
          Boolean(
            position.can_manage_orders
          ),

        can_manage_team:
          Boolean(
            position.can_manage_team
          ),

        can_manage_settings:
          Boolean(
            position.can_manage_settings
          ),

        can_manage_qr_studio:
          Boolean(
            position.can_manage_qr_studio
          ),
      },
    });

  } catch (error: any) {
    console.error(
      'POSITION PERMISSIONS GET ERROR:',
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

export async function PATCH(
  req: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
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
            'Server configuration error.',
        },
        { status: 500 }
      );
    }

    // =========================================================
    // AUTH
    // =========================================================

    const authHeader =
      req.headers.get('authorization');

    if (
      !authHeader?.startsWith('Bearer ')
    ) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
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
    // ADMIN
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
    // POSITION ID
    // =========================================================

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            'Missing position ID.',
        },
        { status: 400 }
      );
    }

    // =========================================================
    // GET POSITION
    // =========================================================

    const {
      data: position,
      error: positionError,
    } =
      await supabaseAdmin
        .from('restaurant_roles')
        .select('*')
        .eq('id', id)
        .single();

    if (
      positionError ||
      !position
    ) {
      return NextResponse.json(
        {
          error:
            'Position not found.',
        },
        { status: 404 }
      );
    }

    // =========================================================
    // VERIFY REQUESTER
    // =========================================================

    const {
      data: membership,
      error: membershipError,
    } =
      await supabaseAdmin
        .from('restaurant_members')
        .select('role')
        .eq(
          'user_id',
          user.id
        )
        .eq(
          'restaurant_id',
          position.restaurant_id
        )
        .single();

    if (
      membershipError ||
      !membership
    ) {
      return NextResponse.json(
        {
          error:
            'You are not a member of this restaurant.',
        },
        { status: 403 }
      );
    }

    const requesterRole =
      membership.role
        ?.toLowerCase()
        .trim();

    if (!await canManageTeam(supabaseAdmin, user.id, position.restaurant_id)) {
      return NextResponse.json(
        {
          error:
            'You do not have permission to manage position permissions.',
        },
        { status: 403 }
      );
    }

    // =========================================================
    // READ BODY
    // =========================================================

    const body = await req.json();

    const permissions = {
      can_view_dashboard:
        Boolean(
          body?.can_view_dashboard
        ),

      can_manage_menu:
        Boolean(
          body?.can_manage_menu
        ),

      can_manage_pricing:
        Boolean(
          body?.can_manage_pricing
        ),

      can_manage_orders:
        Boolean(
          body?.can_manage_orders
        ),

      can_manage_team:
        Boolean(
          body?.can_manage_team
        ),

      can_manage_settings:
        Boolean(
          body?.can_manage_settings
        ),

      can_manage_qr_studio:
        Boolean(
          body?.can_manage_qr_studio
        ),
    };

    // =========================================================
    // UPDATE
    // =========================================================

    const {
      data: updatedPosition,
      error: updateError,
    } =
      await supabaseAdmin
        .from('restaurant_roles')
        .update(permissions)
        .eq('id', id)
        .eq(
          'restaurant_id',
          position.restaurant_id
        )
        .select('*')
        .single();

    if (updateError) {
      console.error(
        'POSITION PERMISSIONS UPDATE ERROR:',
        updateError
      );

      return NextResponse.json(
        {
          error:
            updateError.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      position: updatedPosition,
    });

  } catch (error: any) {
    console.error(
      'POSITION PERMISSIONS ERROR:',
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