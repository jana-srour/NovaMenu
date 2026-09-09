import { createClient } from '@supabase/supabase-js';

type DeleteRestaurantResult = {
  success: boolean;
  restaurantId: string;
  deletedUserIds: string[];
};

export async function deleteRestaurantCompletely(
  restaurantId: string
): Promise<DeleteRestaurantResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  /*
   * Get all members before deleting the restaurant.
   * The restaurant_members rows will be removed automatically
   * by the restaurant CASCADE.
   */
  const { data: members, error: membersError } =
    await supabase
      .from('restaurant_members')
      .select('user_id')
      .eq('restaurant_id', restaurantId);

  if (membersError) {
    throw new Error(
      `Failed to load restaurant members: ${membersError.message}`
    );
  }

  const userIds = Array.from(
    new Set(
      (members ?? [])
        .map((member) => member.user_id)
        .filter(Boolean)
    )
  );

  /*
   * Remove restaurant storage files.
   *
   * NOVAMENU currently uses the menu-images bucket.
   * Files are searched recursively under the restaurant ID.
   */
  try {
    const filesToRemove: string[] = [];

    const collectFiles = async (
      prefix: string
    ): Promise<void> => {
      const { data, error } =
        await supabase.storage
          .from('menu-images')
          .list(prefix, {
            limit: 1000,
          });

      if (error) {
        console.error(
          `Failed to list storage path ${prefix}:`,
          error
        );

        return;
      }

      for (const file of data ?? []) {
        const path = prefix
          ? `${prefix}/${file.name}`
          : file.name;

        /*
         * Supabase Storage returns folders with an empty
         * metadata object. Recursively inspect them.
         */
        if (!file.metadata) {
          await collectFiles(path);
        } else {
          filesToRemove.push(path);
        }
      }
    };

    await collectFiles(restaurantId);

    if (filesToRemove.length > 0) {
      const { error: storageError } =
        await supabase.storage
          .from('menu-images')
          .remove(filesToRemove);

      if (storageError) {
        console.error(
          'Failed to remove restaurant storage files:',
          storageError
        );
      }
    }
  } catch (storageError) {
    /*
     * Storage cleanup should not prevent database cleanup.
     * Database deletion remains the source of truth.
     */
    console.error(
      'Restaurant storage cleanup failed:',
      storageError
    );
  }

  /*
   * Delete the restaurant.
   *
   * Your FK structure has CASCADE on the restaurant-related
   * tables, so this removes the restaurant's database data.
   */
  const { error: restaurantError } =
    await supabase
      .from('restaurants')
      .delete()
      .eq('id', restaurantId);

  if (restaurantError) {
    throw new Error(
      `Failed to delete restaurant: ${restaurantError.message}`
    );
  }

  /*
   * Delete auth users belonging exclusively to this restaurant.
   *
   * A team member could theoretically belong to another
   * restaurant, so we first check whether they still have
   * another restaurant membership.
   */
  const deletedUserIds: string[] = [];

  for (const userId of userIds) {
    const { data: remainingMemberships, error } =
      await supabase
        .from('restaurant_members')
        .select('restaurant_id')
        .eq('user_id', userId)
        .limit(1);

    if (error) {
      console.error(
        `Failed to check remaining memberships for ${userId}:`,
        error
      );

      continue;
    }

    if (
      !remainingMemberships ||
      remainingMemberships.length === 0
    ) {
      const { error: deleteUserError } =
        await supabase.auth.admin.deleteUser(userId);

      if (deleteUserError) {
        console.error(
          `Failed to delete auth user ${userId}:`,
          deleteUserError
        );

        continue;
      }

      deletedUserIds.push(userId);
    }
  }

  console.log(
    `Restaurant completely deleted: ${restaurantId}`
  );

  return {
    success: true,
    restaurantId,
    deletedUserIds,
  };
}