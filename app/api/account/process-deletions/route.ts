import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deleteRestaurantCompletely } from '@/lib/server/delete-restaurant';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const cronSecret =
    process.env.CRON_SECRET;

  const authorization =
    request.headers.get('authorization');

  if (
    !cronSecret ||
    authorization !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      { error: 'Unauthorized.' },
      { status: 401 }
    );
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now =
      new Date().toISOString();

    const { data: dueSubscriptions, error } =
      await supabase
        .from('restaurant_subscriptions')
        .select(
          `
            restaurant_id,
            deletion_requested_at,
            deletion_scheduled_at,
            status
          `
        )
        .not(
          'deletion_requested_at',
          'is',
          null
        )
        .not(
          'deletion_scheduled_at',
          'is',
          null
        )
        .lte(
          'deletion_scheduled_at',
          now
        );

    if (error) {
      throw error;
    }

    const deleted: string[] = [];

    for (const subscription of
      dueSubscriptions ?? []) {
      try {
        await deleteRestaurantCompletely(
          subscription.restaurant_id
        );

        deleted.push(
          subscription.restaurant_id
        );
      } catch (error) {
        console.error(
          `Failed to delete restaurant ${subscription.restaurant_id}:`,
          error
        );
      }
    }

    return NextResponse.json({
      success: true,
      deleted,
    });
  } catch (error) {
    console.error(
      'Deletion cleanup failed:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Deletion cleanup failed.',
      },
      { status: 500 }
    );
  }
}