import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { canManageTeam } from '@/lib/team-permissions';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

async function getAuthorizedUser(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return {
      error: NextResponse.json(
        { error: 'Server configuration error.' },
        { status: 500 }
      ),
    };
  }

  const authHeader = req.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 }
      ),
    };
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
    return {
      error: NextResponse.json(
        { error: 'Invalid or expired session.' },
        { status: 401 }
      ),
    };
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

  const {
    data: membership,
    error: membershipError,
  } = await supabaseAdmin
    .from('restaurant_members')
    .select('restaurant_id, role')
    .eq('user_id', user.id)
    .single();

  if (membershipError || !membership) {
    return {
      error: NextResponse.json(
        { error: 'You are not a member of a restaurant.' },
        { status: 403 }
      ),
    };
  }

  const requesterRole =
    membership.role?.toLowerCase().trim();

  if (!await canManageTeam(supabaseAdmin, user.id, membership.restaurant_id)) {
    return {
      error: NextResponse.json(
        {
          error:
            'You do not have permission to manage positions.',
        },
        { status: 403 }
      ),
    };
  }

  return {
    supabaseAdmin,
    restaurantId: membership.restaurant_id,
  };
}


// ============================================================
// UPDATE POSITION
// ============================================================

export async function PATCH(
  req: Request,
  context: RouteContext
) {
  try {
    const auth = await getAuthorizedUser(req);

    if ('error' in auth) {
      return auth.error;
    }

    const { supabaseAdmin, restaurantId } = auth;

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: 'Position ID is required.' },
        { status: 400 }
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

    // Make sure the position belongs to this restaurant
    const { data: existingPosition, error: findError } =
      await supabaseAdmin
        .from('restaurant_roles')
        .select('id, name')
        .eq('id', id)
        .eq('restaurant_id', restaurantId)
        .single();

    if (findError || !existingPosition) {
      return NextResponse.json(
        { error: 'Position not found.' },
        { status: 404 }
      );
    }

    // Prevent duplicate names
    const { data: duplicatePosition } =
      await supabaseAdmin
        .from('restaurant_roles')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .ilike('name', name)
        .neq('id', id)
        .maybeSingle();

    if (duplicatePosition) {
      return NextResponse.json(
        { error: 'This position already exists.' },
        { status: 400 }
      );
    }

    const { data: updatedPosition, error: updateError } =
      await supabaseAdmin
        .from('restaurant_roles')
        .update({
          name,
        })
        .eq('id', id)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    // Keep existing team members synchronized.
    //
    // Your restaurant_members.role currently stores the
    // position name, so when the position is renamed we
    // update members who had the old position name.

    if (
      existingPosition.name !== updatedPosition.name
    ) {
      const { error: memberUpdateError } =
        await supabaseAdmin
          .from('restaurant_members')
          .update({
            role: updatedPosition.name,
          })
          .eq('restaurant_id', restaurantId)
          .eq('role', existingPosition.name);

      if (memberUpdateError) {
        return NextResponse.json(
          {
            error:
              'Position renamed, but existing team members could not be updated: ' +
              memberUpdateError.message,
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      position: updatedPosition,
    });

  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.message ||
          'Internal Server Error.',
      },
      { status: 500 }
    );
  }
}


// ============================================================
// DELETE POSITION
// ============================================================

export async function DELETE(
  req: Request,
  context: RouteContext
) {
  try {
    const auth = await getAuthorizedUser(req);

    if ('error' in auth) {
      return auth.error;
    }

    const { supabaseAdmin, restaurantId } = auth;

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: 'Position ID is required.' },
        { status: 400 }
      );
    }

    // Find position
    const { data: position, error: findError } =
      await supabaseAdmin
        .from('restaurant_roles')
        .select('id, name')
        .eq('id', id)
        .eq('restaurant_id', restaurantId)
        .single();

    if (findError || !position) {
      return NextResponse.json(
        { error: 'Position not found.' },
        { status: 404 }
      );
    }

    // Check if any team member currently uses this position
    const { count: memberCount, error: memberCheckError } =
      await supabaseAdmin
        .from('restaurant_members')
        .select('user_id', {
          count: 'exact',
          head: true,
        })
        .eq('restaurant_id', restaurantId)
        .eq('role', position.name);

    if (memberCheckError) {
      return NextResponse.json(
        { error: memberCheckError.message },
        { status: 400 }
      );
    }

    if ((memberCount || 0) > 0) {
      return NextResponse.json(
        {
          error:
            `Cannot delete "${position.name}" because ` +
            `${memberCount} team member${
              memberCount === 1 ? '' : 's'
            } currently use this position. ` +
            `Change their position first.`,
        },
        { status: 400 }
      );
    }

    const { error: deleteError } =
      await supabaseAdmin
        .from('restaurant_roles')
        .delete()
        .eq('id', id)
        .eq('restaurant_id', restaurantId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Position deleted successfully.',
    });

  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.message ||
          'Internal Server Error.',
      },
      { status: 500 }
    );
  }
}