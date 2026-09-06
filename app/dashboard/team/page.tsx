'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BriefcaseBusiness,
  Filter,
  Search,
  Users,
} from 'lucide-react';import { supabase } from '@/lib/supabase';
import { subscribeRestaurantRealtime } from '@/lib/live-sync';
import { DashboardLoader } from '@/app/dashboard/components/dashboard-loader';
import { PlanRequired } from '@/app/dashboard/components/plan-required';
import {
  subscriptionAllows,
  type BillingPlan,
  type SubscriptionStatus,
} from '@/lib/billing/plans';

interface TeamMember {
  user_id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

interface TeamPosition {
  id: string;
  restaurant_id: string;
  name: string;
  created_at: string;

  can_manage_menu: boolean;
  can_manage_pricing: boolean;
  can_manage_orders: boolean;
  can_manage_team: boolean;
  can_manage_settings: boolean;
  can_view_dashboard: boolean;
  can_manage_qr_studio: boolean;
}

export default function TeamPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');

  const [restaurantId, setRestaurantId] =
    useState<string | null>(null);

  const [ownerUserId, setOwnerUserId] =
    useState<string | null>(null);

  const [members, setMembers] =
    useState<TeamMember[]>([]);

  const [positions, setPositions] =
    useState<TeamPosition[]>([]);

  const [newPosition, setNewPosition] =
    useState('');

  const [addingPosition, setAddingPosition] =
    useState(false);

  const [editingPosition, setEditingPosition] =
    useState<TeamPosition | null>(null);

  const [editingPositionName, setEditingPositionName] =
    useState('');

  const [savingPosition, setSavingPosition] =
    useState(false);

  const [deletingPositionId, setDeletingPositionId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [fetchingData, setFetchingData] =
    useState(true);

  const [planAllowed, setPlanAllowed] = useState(true);

  const [managingMember, setManagingMember] =
    useState<TeamMember | null>(null);

  const [editName, setEditName] =
    useState('');

  const [savingName, setSavingName] =
    useState(false);

  const [editRole, setEditRole] =
    useState('');

  const [savingRole, setSavingRole] =
    useState(false);

  const [resetPassword, setResetPassword] =
    useState('');

  const [resettingPassword, setResettingPassword] =
    useState(false);

  const [deletingMember, setDeletingMember] =
    useState(false);

  const getErrorMessage = (
    error: unknown,
    fallback = 'Something went wrong.'
  ) =>
    error instanceof Error
      ? error.message
      : fallback;

  // =========================================================
  // PERMISSIONS
  // =========================================================

  const [editingPermissions, setEditingPermissions] =
    useState<TeamPosition | null>(null);

  const [permissionValues, setPermissionValues] =
    useState({
      can_view_dashboard: true,
      can_manage_menu: false,
      can_manage_pricing: false,
      can_manage_orders: false,
      can_manage_team: false,
      can_manage_settings: false,
      can_manage_qr_studio: false,
    });

  const [savingPermissions, setSavingPermissions] =
    useState(false);

  const [message, setMessage] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  const [memberSearch, setMemberSearch] = useState('');
  const [memberPositionFilter, setMemberPositionFilter] = useState('all');
  const [memberSort, setMemberSort] = useState<
    'name' | 'position' | 'created_at'
  >('created_at');
  const [memberSortDirection, setMemberSortDirection] = useState<'asc' | 'desc'>('desc');


  // =========================================================
  // LOAD TEAM DATA
  // =========================================================

  const loadTeamData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setFetchingData(true);
      }
      setMessage(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessage({
          type: 'error',
          text: 'You are not logged in.',
        });

        if (showLoading) {
          setFetchingData(false);
        }
        return;
      }

      setOwnerUserId(session.user.id);

      const response = await fetch(
        '/api/team/members',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage({
          type: 'error',
          text: result.error || 'Failed to load team.',
        });

        if (showLoading) {
          setFetchingData(false);
        }
        return;
      }

      setRestaurantId(result.restaurantId);

      const { data: subscription } = await supabase
        .from('restaurant_subscriptions')
        .select('plan_code, status, trial_ends_at')
        .eq('restaurant_id', result.restaurantId)
        .maybeSingle();

      const allowed = subscriptionAllows(
        subscription as {
          plan_code: BillingPlan;
          status: SubscriptionStatus;
          trial_ends_at: string;
        } | null,
        'team'
      );

      setPlanAllowed(allowed);

      if (!allowed) {
        return;
      }

      setMembers(
        Array.isArray(result.members)
          ? result.members
          : []
      );

      const { data: positionData, error: positionError } = await supabase
        .from('restaurant_roles')
        .select('*')
        .eq('restaurant_id', result.restaurantId)
        .order('created_at', { ascending: true });

      if (positionError) {
        setMessage({
          type: 'error',
          text: positionError.message,
        });
      } else {
        const loadedPositions = positionData || [];
        setPositions(loadedPositions);

        if (loadedPositions.length > 0) {
          setRole(loadedPositions[0].name);
        }
      }
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(error, 'Failed to load team.'),
      });
    } finally {
      if (showLoading) {
        setFetchingData(false);
      }
    }
  };

  useEffect(() => {
    void (async () => {
      await loadTeamData();
    })();
  }, []);

  useEffect(() => {
    if (!restaurantId) {
      return;
    }

    let active = true;
    let refreshInProgress = false;

    const refreshTeam = async () => {
      if (!active || refreshInProgress) {
        return;
      }

      refreshInProgress = true;
      try {
        await loadTeamData(false);
      } finally {
        refreshInProgress = false;
      }
    };

    const unsubscribe = subscribeRestaurantRealtime(supabase, {
      restaurantId,
      name: 'dashboard-team',
      tables: ['restaurant_members', 'restaurant_roles'],
      onChange: refreshTeam,
      onStatus: (status) => {
        if (status === 'SUBSCRIBED') {
          setMessage((current) =>
            current?.text.startsWith('Team live updates are unavailable')
              ? null
              : current
          );
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setMessage({
            type: 'error',
            text: 'Team live updates are unavailable. Run the Supabase Realtime query and check its status.',
          });
        }
      },
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [restaurantId]);

  // =========================================================
  // REFRESH MEMBERS
  // =========================================================

  const refreshMembers = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch(
        '/api/team/members',
        {
          method: 'GET',
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMembers(
          Array.isArray(result.members)
            ? result.members
            : []
        );
      }
    } catch (error) {
      console.error(
        'REFRESH MEMBERS ERROR:',
        error
      );
    }
  };

  // =========================================================
  // ADD TEAM MEMBER
  // =========================================================

  const handleAddWorker = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setMessage(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!restaurantId || !ownerUserId) {
      setMessage({
        type: 'error',
        text:
          'Missing restaurant information. Please refresh.',
      });

      return;
    }

    if (!trimmedName) {
      setMessage({
        type: 'error',
        text: 'Please enter the team member name.',
      });

      return;
    }

    if (!trimmedEmail) {
      setMessage({
        type: 'error',
        text: 'Please enter an email address.',
      });

      return;
    }

    if (!role) {
      setMessage({
        type: 'error',
        text:
          'Please select a team position.',
      });

      return;
    }

    if (password.length < 6) {
      setMessage({
        type: 'error',
        text:
          'Password must be at least 6 characters.',
      });

      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessage({
          type: 'error',
          text:
            'Your session has expired. Please log in again.',
        });

        return;
      }

      const response = await fetch(
        '/api/team/add-worker',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            name: trimmedName,
            email: trimmedEmail,
            password,
            role,
            restaurantId,
          }),
        }
      );

      const contentType =
        response.headers.get(
          'content-type'
        ) || '';

      let result: { error?: string } = {};

      if (
        contentType.includes(
          'application/json'
        )
      ) {
        result = await response.json();
      } else {
        result = {
          error:
            `Server returned an unexpected response (${response.status}).`,
        };
      }

      if (!response.ok) {
        setMessage({
          type: 'error',
          text:
            result.error ||
            'Failed to create team member.',
        });

        return;
      }

      setMessage({
        type: 'success',
        text:
          `${trimmedName} was added successfully as ${role}.`,
      });

      setName('');
      setEmail('');
      setPassword('');

      await refreshMembers();
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // UPDATE TEAM MEMBER POSITION
  // =========================================================

  const handleUpdateRole = async () => {
    if (
      !managingMember ||
      !restaurantId ||
      !editRole
    ) {
      return;
    }

    setSavingRole(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessage({
          type: 'error',
          text:
            'Your session has expired. Please log in again.',
        });

        return;
      }

      const response = await fetch(
        '/api/team/update-role',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            memberUserId:
              managingMember.user_id,
            restaurantId,
            role: editRole,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage({
          type: 'error',
          text:
            result.error ||
            'Failed to update position.',
        });

        return;
      }

      setMembers((currentMembers) =>
        currentMembers.map((member) =>
          member.user_id ===
          managingMember.user_id
            ? {
                ...member,
                role: editRole,
              }
            : member
        )
      );

      setManagingMember((current) =>
        current
          ? {
              ...current,
              role: editRole,
            }
          : null
      );

      setMessage({
        type: 'success',
        text:
          'Team member position updated successfully.',
      });

    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(error),
      });
    } finally {
      setSavingRole(false);
    }
  };

  // =========================================================
  // UPDATE TEAM MEMBER NAME
  // =========================================================

  const handleUpdateName = async () => {
    if (
      !managingMember ||
      !restaurantId
    ) {
      return;
    }

    const trimmedName =
      editName.trim();

    if (!trimmedName) {
      setMessage({
        type: 'error',
        text:
          'Please enter a team member name.',
      });

      return;
    }

    setSavingName(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessage({
          type: 'error',
          text:
            'Your session has expired. Please log in again.',
        });

        return;
      }

      const response = await fetch(
        '/api/team/update-name',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            memberUserId:
              managingMember.user_id,
            restaurantId,
            name: trimmedName,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage({
          type: 'error',
          text:
            result.error ||
            'Failed to update name.',
        });

        return;
      }

      setMembers((currentMembers) =>
        currentMembers.map((member) =>
          member.user_id ===
          managingMember.user_id
            ? {
                ...member,
                name: trimmedName,
              }
            : member
        )
      );

      setManagingMember((current) =>
        current
          ? {
              ...current,
              name: trimmedName,
            }
          : null
      );

      setEditName(trimmedName);

      setMessage({
        type: 'success',
        text:
          'Team member name updated successfully.',
      });

      if (restaurantId) {
      }
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(error),
      });
    } finally {
      setSavingName(false);
    }
  };

  // =========================================================
  // RESET PASSWORD
  // =========================================================

  const handleResetPassword = async () => {
    if (
      !managingMember ||
      !restaurantId
    ) {
      return;
    }

    if (resetPassword.length < 6) {
      setMessage({
        type: 'error',
        text:
          'Password must be at least 6 characters.',
      });

      return;
    }

    setResettingPassword(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessage({
          type: 'error',
          text:
            'Your session has expired. Please log in again.',
        });

        return;
      }

      const response = await fetch(
        '/api/team/reset-password',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            memberUserId:
              managingMember.user_id,
            restaurantId,
            password: resetPassword,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage({
          type: 'error',
          text:
            result.error ||
            'Failed to reset password.',
        });

        return;
      }

      setResetPassword('');

      setMessage({
        type: 'success',
        text:
          'Team member password reset successfully.',
      });

      if (restaurantId) {
      }
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(error),
      });
    } finally {
      setResettingPassword(false);
    }
  };

  // =========================================================
  // DELETE TEAM MEMBER
  // =========================================================

  const handleDeleteMember = async () => {
    if (
      !managingMember ||
      !restaurantId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Are you sure you want to permanently remove ${managingMember.name || managingMember.email} from this restaurant?`
      );

    if (!confirmed) {
      return;
    }

    setDeletingMember(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessage({
          type: 'error',
          text:
            'Your session has expired. Please log in again.',
        });

        return;
      }

      const response = await fetch(
        '/api/team/remove-member',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            memberUserId:
              managingMember.user_id,
            restaurantId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage({
          type: 'error',
          text:
            result.error ||
            'Failed to remove team member.',
        });

        return;
      }

      setMembers((currentMembers) =>
        currentMembers.filter(
          (member) =>
            member.user_id !==
            managingMember.user_id
        )
      );

      setManagingMember(null);
      setEditName('');
      setEditRole('');
      setResetPassword('');

      setMessage({
        type: 'success',
        text:
          'Team member removed successfully.',
      });

    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(error),
      });
    } finally {
      setDeletingMember(false);
    }
  };

  // =========================================================
  // ADD POSITION
  // =========================================================

  const handleAddPosition = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const positionName =
      newPosition.trim();

    if (!positionName) {
      setMessage({
        type: 'error',
        text:
          'Please enter a position name.',
      });

      return;
    }

    setAddingPosition(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessage({
          type: 'error',
          text:
            'Your session has expired. Please log in again.',
        });

        return;
      }

      const response = await fetch(
        '/api/team/positions',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            name: positionName,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage({
          type: 'error',
          text:
            result.error ||
            'Failed to add position.',
        });

        return;
      }

      if (result.position) {
        setPositions((current) => [
          ...current,
          result.position,
        ]);

        if (positions.length === 0) {
          setRole(result.position.name);
        }
      }

      setNewPosition('');

      setMessage({
        type: 'success',
        text:
          `"${positionName}" position added successfully.`,
      });

      if (restaurantId) {
      }
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text:
          getErrorMessage(
            error,
            'Something went wrong while adding the position.'
          ),
      });
    } finally {
      setAddingPosition(false);
    }
  };

  // =========================================================
  // UPDATE POSITION
  // =========================================================

  const handleSavePosition = async () => {
    if (!editingPosition) {
      return;
    }

    const newName =
      editingPositionName.trim();

    if (!newName) {
      setMessage({
        type: 'error',
        text:
          'Please enter a position name.',
      });

      return;
    }

    setSavingPosition(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessage({
          type: 'error',
          text:
            'Your session has expired. Please log in again.',
        });

        return;
      }

      const response = await fetch(
        `/api/team/positions/${editingPosition.id}`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            name: newName,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage({
          type: 'error',
          text:
            result.error ||
            'Failed to update position.',
        });

        return;
      }

      const oldName =
        editingPosition.name;

      const updatedPosition =
        result.position || {
          ...editingPosition,
          name: newName,
        };

      setPositions((current) =>
        current.map((position) =>
          position.id ===
          editingPosition.id
            ? updatedPosition
            : position
        )
      );

      setMembers((currentMembers) =>
        currentMembers.map((member) =>
          member.role.toLowerCase() ===
          oldName.toLowerCase()
            ? {
                ...member,
                role: newName,
              }
            : member
        )
      );

      if (
        role.toLowerCase() ===
        oldName.toLowerCase()
      ) {
        setRole(newName);
      }

      if (
        editRole.toLowerCase() ===
        oldName.toLowerCase()
      ) {
        setEditRole(newName);
      }

      setEditingPosition(null);
      setEditingPositionName('');

      setMessage({
        type: 'success',
        text:
          `Position renamed to "${newName}".`,
      });

      if (restaurantId) {
      }
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text:
          getErrorMessage(
            error,
            'Something went wrong while updating the position.'
          ),
      });
    } finally {
      setSavingPosition(false);
    }
  };

  // =========================================================
  // DELETE POSITION
  // =========================================================

  const handleDeletePosition = async (
    position: TeamPosition
  ) => {
    const confirmed =
      window.confirm(
        `Delete the "${position.name}" position?\n\nThis position can only be deleted if no team member is currently assigned to it.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingPositionId(position.id);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessage({
          type: 'error',
          text:
            'Your session has expired. Please log in again.',
        });

        return;
      }

      const response = await fetch(
        `/api/team/positions/${position.id}`,
        {
          method: 'DELETE',

          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage({
          type: 'error',
          text:
            result.error ||
            'Failed to delete position.',
        });

        return;
      }

      const remainingPositions =
        positions.filter(
          (item) =>
            item.id !== position.id
        );

      setPositions(
        remainingPositions
      );

      if (
        role.toLowerCase() ===
        position.name.toLowerCase()
      ) {
        setRole(
          remainingPositions.length > 0
            ? remainingPositions[0].name
            : ''
        );
      }

      setMessage({
        type: 'success',
        text:
          `"${position.name}" position deleted.`,
      });

      if (restaurantId) {
      }
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text:
          getErrorMessage(
            error,
            'Something went wrong while deleting the position.'
          ),
      });
    } finally {
      setDeletingPositionId(null);
    }
  };

  // =========================================================
  // PERMISSION MODAL
  // =========================================================

  const openPermissions = (
    position: TeamPosition
  ) => {
    setEditingPermissions(position);

    setPermissionValues({
      can_view_dashboard:
        position.can_view_dashboard ?? true,

      can_manage_menu:
        position.can_manage_menu ?? false,

      can_manage_pricing:
        position.can_manage_pricing ?? false,

      can_manage_orders:
        position.can_manage_orders ?? false,

      can_manage_team:
        position.can_manage_team ?? false,

      can_manage_settings:
        position.can_manage_settings ?? false,

      can_manage_qr_studio:
        position.can_manage_qr_studio ?? false,
    });

    setMessage(null);
  };

  const handleSavePermissions = async () => {
    if (!editingPermissions) {
      return;
    }

    setSavingPermissions(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessage({
          type: 'error',
          text:
            'Your session has expired. Please log in again.',
        });

        return;
      }

      const nextPermissions = {
        ...permissionValues,
      };

      const response = await fetch(
        `/api/team/positions/${editingPermissions.id}/permissions`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify(
            nextPermissions
          ),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage({
          type: 'error',
          text:
            result.error ||
            'Failed to save permissions.',
        });

        return;
      }

      const updated =
        result.position || {
          ...editingPermissions,
          ...permissionValues,
        };

      setPositions((current) =>
        current.map((position) =>
          position.id ===
          editingPermissions.id
            ? updated
            : position
        )
      );

      setEditingPermissions(null);

      setMessage({
        type: 'success',
        text:
          `Permissions for "${editingPermissions.name}" updated successfully.`,
      });
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text:
          getErrorMessage(
            error,
            'Something went wrong while saving permissions.'
          ),
      });
    } finally {
      setSavingPermissions(false);
    }
  };

  // =========================================================
  // CLOSE MANAGE MEMBER
  // =========================================================

  const closeManageMember = () => {
    setManagingMember(null);
    setEditName('');
    setEditRole('');
    setResetPassword('');
    setSavingName(false);
    setSavingRole(false);
    setResettingPassword(false);
    setDeletingMember(false);
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (fetchingData) {
    return <DashboardLoader />;
  }

  if (!planAllowed) {
    return (
      <PlanRequired
        featureName="Team Management"
        requiredPlan="Enterprise"
      />
    );
  }

  // =========================================================
  // SORTING & FILTERING CONTROLS
  // =========================================================
  const handleMemberSort = (
    field: 'name' | 'position' | 'created_at',
  ) => {
    if (memberSort === field) {
      setMemberSortDirection((current) =>
        current === 'asc' ? 'desc' : 'asc',
      );
      return;
    }

    setMemberSort(field);
    setMemberSortDirection(field === 'created_at' ? 'desc' : 'asc');
  };

  const filteredAndSortedMembers = [...members]
    .filter((member) => {
      const query = memberSearch.trim().toLowerCase();

      if (query) {
        const searchable = [
          member.name,
          member.email,
          member.role,
        ]
          .join(' ')
          .toLowerCase();

        if (!searchable.includes(query)) {
          return false;
        }
      }

      if (memberPositionFilter !== 'all') {
        const positionName =
          positions.find(
            (position) =>
              position.name.toLowerCase() ===
              member.role.toLowerCase(),
          )?.name || member.role;

        if (
          positionName.toLowerCase() !==
          memberPositionFilter.toLowerCase()
        ) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      const direction = memberSortDirection === 'asc' ? 1 : -1;

      switch (memberSort) {
        case 'name':
          return (
            direction *
            (a.name || a.email).localeCompare(b.name || b.email)
          );

        case 'position': {
          const aPosition =
            positions.find(
              (position) =>
                position.name.toLowerCase() ===
                a.role.toLowerCase(),
            )?.name || a.role;

          const bPosition =
            positions.find(
              (position) =>
                position.name.toLowerCase() ===
                b.role.toLowerCase(),
            )?.name || b.role;

          return direction * aPosition.localeCompare(bPosition);
        }

        case 'created_at':
        default:
          return (
            direction *
            (new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime())
          );
      }
    });

    const renderMemberSortIcon = (
      field: 'name' | 'position' | 'created_at',
    ) => {
      if (memberSort !== field) {
        return (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
        );
      }

      return memberSortDirection === 'asc' ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : (
        <ArrowDown className="h-3.5 w-3.5" />
      );
    };
  
  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="min-h-screen font-sans" style={{ background: 'var(--portal-background)', color: 'var(--portal-text)' }}>

      {/* HEADER */}

      <header
        className="h-[72px] border-b sticky top-0 z-30 backdrop-blur-xl"
        style={{
          background: 'color-mix(in srgb, var(--portal-background) 92%, transparent)',
          borderColor: 'var(--portal-border)',
        }}
      >
        <div className="h-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="min-w-0">
            <p
              className="text-[10px] uppercase tracking-[0.16em] font-bold"
              style={{ color: 'var(--portal-accent)' }}
            >
              Workspace
            </p>

            <h1
              className="text-[15px] font-semibold tracking-[-0.01em] mt-0.5 truncate"
              style={{ color: 'var(--portal-text)' }}
            >
              Team Management
            </h1>
          </div>

          <div
            className="w-9 h-9 rounded-lg border flex items-center justify-center text-xs font-bold shrink-0"
            style={{
              background: 'var(--portal-accent-soft)',
              borderColor: 'var(--portal-border)',
              color: 'var(--portal-accent)',
            }}
          >
            T
          </div>
        </div>
      </header>

      {/* CONTENT */}

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-7">

        {/* INTRO */}

        <div className="mb-7">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p
                className="text-[10px] uppercase tracking-[0.16em] font-bold"
                style={{ color: 'var(--portal-accent)' }}
              >
                Team
              </p>

              <h2
                className="text-[26px] sm:text-[28px] font-semibold tracking-[-0.035em] mt-1"
                style={{ color: 'var(--portal-text)' }}
              >
                Team Management
              </h2>

              <p
                className="text-sm mt-1.5 max-w-xl"
                style={{
                  color: 'color-mix(in srgb, var(--portal-text) 62%, transparent)',
                }}
              >
                Manage your restaurant team, positions, and access permissions.
              </p>
            </div>

            <div
              className="hidden sm:flex items-center gap-2 text-xs font-medium"
              style={{
                color: 'color-mix(in srgb, var(--portal-text) 58%, transparent)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--portal-accent)' }}
              />
              Team workspace
            </div>
          </div>
        </div>

        {/* MESSAGE */}

        {message && (
          <div
            className="mb-6 px-4 py-3.5 rounded-xl border text-sm font-medium"
            style={{
              background:
                message.type === 'error'
                  ? 'color-mix(in srgb, var(--portal-text) 5%, var(--portal-surface))'
                  : 'var(--portal-accent-soft)',
              color: 'var(--portal-text)',
              borderColor: 'var(--portal-border)',
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: 'var(--portal-accent)' }}
              />

              <span>{message.text}</span>
            </div>
          </div>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {/* Team Members */}
          <div
            className="border rounded-xl px-4 py-4"
            style={{
              background: 'var(--portal-surface)',
              borderColor: 'var(--portal-border)',
            }}
          >
            <div className="flex items-center justify-between">
              <p
                className="text-[10px] uppercase tracking-[0.14em] font-bold"
                style={{
                  color: 'color-mix(in srgb, var(--portal-text) 55%, transparent)',
                }}
              >
                Team Members
              </p>

              <Users
                size={15}
                strokeWidth={1.8}
                style={{
                  color: 'var(--portal-accent)',
                }}
              />
            </div>

            <div className="mt-2 flex items-end gap-2">
              <span
                className="text-2xl font-semibold tracking-[-0.03em]"
                style={{ color: 'var(--portal-text)' }}
              >
                {members.length}
              </span>

              <span
                className="text-xs mb-1"
                style={{
                  color: 'color-mix(in srgb, var(--portal-text) 50%, transparent)',
                }}
              >
                accounts
              </span>
            </div>
          </div>

          {/* Positions */}
          <div
            className="border rounded-xl px-4 py-4"
            style={{
              background: 'var(--portal-surface)',
              borderColor: 'var(--portal-border)',
            }}
          >
            <div className="flex items-center justify-between">
              <p
                className="text-[10px] uppercase tracking-[0.14em] font-bold"
                style={{
                  color: 'color-mix(in srgb, var(--portal-text) 55%, transparent)',
                }}
              >
                Positions
              </p>

              <BriefcaseBusiness
                size={15}
                strokeWidth={1.8}
                style={{
                  color: 'var(--portal-accent)',
                }}
              />
            </div>

            <div className="mt-2 flex items-end gap-2">
              <span
                className="text-2xl font-semibold tracking-[-0.03em]"
                style={{ color: 'var(--portal-text)' }}
              >
                {positions.length}
              </span>

              <span
                className="text-xs mb-1"
                style={{
                  color: 'color-mix(in srgb, var(--portal-text) 50%, transparent)',
                }}
              >
                defined
              </span>
            </div>
          </div>

          {/* Active Accounts */}
          <div
            className="border rounded-xl px-4 py-4"
            style={{
              background: 'var(--portal-surface)',
              borderColor: 'var(--portal-border)',
            }}
          >
            <div className="flex items-center justify-between">
              <p
                className="text-[10px] uppercase tracking-[0.14em] font-bold"
                style={{
                  color: 'color-mix(in srgb, var(--portal-text) 55%, transparent)',
                }}
              >
                Active Accounts
              </p>

              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: 'var(--portal-accent)',
                }}
              />
            </div>

            <div className="mt-2 flex items-end gap-2">
              <span
                className="text-2xl font-semibold tracking-[-0.03em]"
                style={{ color: 'var(--portal-text)' }}
              >
                {members.length}
              </span>

              <span
                className="text-xs mb-1"
                style={{
                  color: 'color-mix(in srgb, var(--portal-text) 50%, transparent)',
                }}
              >
                currently active
              </span>
            </div>
          </div>
        </section>

        {/* MAIN GRID */}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:gap-6">

        {/* TEAM MEMBERS */}

          <div className="xl:col-span-8">
            <section
              className="border rounded-2xl overflow-hidden"
              style={{
                background: 'var(--portal-surface)',
                borderColor: 'var(--portal-border)',
              }}
            >
              {/* Section Header */}
              <div
                className="px-5 sm:px-6 py-5 border-b"
                style={{ borderColor: 'var(--portal-border)' }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p
                      className="text-[10px] uppercase tracking-[0.14em] font-bold"
                      style={{ color: 'var(--portal-accent)' }}
                    >
                      Accounts
                    </p>

                    <h3
                      className="text-lg font-semibold tracking-[-0.02em] mt-1"
                      style={{ color: 'var(--portal-text)' }}
                    >
                      Team Members
                    </h3>

                    <p
                      className="text-xs mt-1"
                      style={{
                        color:
                          'color-mix(in srgb, var(--portal-text) 55%, transparent)',
                      }}
                    >
                      People with access to this restaurant workspace.
                    </p>
                  </div>

                  <div
                    className="shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold border"
                    style={{
                      background: 'var(--portal-accent-soft)',
                      borderColor: 'var(--portal-border)',
                      color: 'var(--portal-accent)',
                    }}
                  >
                    {members.length}
                  </div>
                </div>
              </div>

              {/* Team Members Table */}
              {members.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <div
                    className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border"
                    style={{
                      background: 'var(--portal-background)',
                      borderColor: 'var(--portal-border)',
                      color: 'var(--portal-accent)',
                    }}
                  >
                    <Users size={18} strokeWidth={1.7} />
                  </div>

                  <h4
                    className="mt-4 text-sm font-semibold"
                    style={{ color: 'var(--portal-text)' }}
                  >
                    No team members yet
                  </h4>

                  <p
                    className="mt-1 text-xs"
                    style={{
                      color:
                        'color-mix(in srgb, var(--portal-text) 55%, transparent)',
                    }}
                  >
                    Add your first team member using the form beside this list.
                  </p>
                </div>
              ) : (
                <>
                  {/* Table Controls */}
                  <div
                    className="flex flex-col gap-3 border-b px-5 py-4 sm:px-6 lg:flex-row lg:items-center"
                    style={{
                      borderColor: 'var(--portal-border)',
                      background: 'var(--portal-background)',
                    }}
                  >
                    <div className="relative min-w-0 flex-1">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                        style={{
                          color:
                            'color-mix(in srgb, var(--portal-text) 50%, transparent)',
                        }}
                      />

                      <input
                        type="search"
                        value={memberSearch}
                        onChange={(event) =>
                          setMemberSearch(event.target.value)
                        }
                        placeholder="Search members..."
                        className="h-9 w-full rounded-lg border bg-transparent pl-9 pr-3 text-xs outline-none transition"
                        style={{
                          borderColor: 'var(--portal-border)',
                          color: 'var(--portal-text)',
                        }}
                      />
                    </div>

                    <div
                      className="flex items-center gap-2 rounded-lg border px-3"
                      style={{
                        borderColor: 'var(--portal-border)',
                        background: 'var(--portal-surface)',
                      }}
                    >
                      <Filter
                        className="h-3.5 w-3.5 shrink-0"
                        style={{
                          color:
                            'color-mix(in srgb, var(--portal-text) 55%, transparent)',
                        }}
                      />

                      <select
                        value={memberPositionFilter}
                        onChange={(event) =>
                          setMemberPositionFilter(event.target.value)
                        }
                        className="h-9 bg-transparent text-xs outline-none"
                        style={{ color: 'var(--portal-text)' }}
                      >
                        <option value="all">All positions</option>

                        {positions.map((position) => (
                          <option key={position.id} value={position.name}>
                            {position.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {(memberSearch || memberPositionFilter !== 'all') && (
                      <span
                        className="text-[10px] font-semibold whitespace-nowrap"
                        style={{
                          color:
                            'color-mix(in srgb, var(--portal-text) 55%, transparent)',
                        }}
                      >
                        {filteredAndSortedMembers.length} of {members.length}
                      </span>
                    )}
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-[720px] w-full text-left">
                      <thead
                        style={{
                          background: 'var(--portal-background)',
                        }}
                      >
                        <tr
                          className="border-b"
                          style={{
                            borderColor: 'var(--portal-border)',
                          }}
                        >
                          {/* Member */}
                          <th
                            className="cursor-pointer px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] sm:px-6"
                            style={{
                              color:
                                'color-mix(in srgb, var(--portal-text) 55%, transparent)',
                            }}
                            onClick={() => handleMemberSort('name')}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              Member
                              {renderMemberSortIcon('name')}
                            </span>
                          </th>

                          {/* Position */}
                          <th
                            className="cursor-pointer px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em]"
                            style={{
                              color:
                                'color-mix(in srgb, var(--portal-text) 55%, transparent)',
                            }}
                            onClick={() => handleMemberSort('position')}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              Position
                              {renderMemberSortIcon('position')}
                            </span>
                          </th>

                          {/* Added */}
                          <th
                            className="cursor-pointer px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em]"
                            style={{
                              color:
                                'color-mix(in srgb, var(--portal-text) 55%, transparent)',
                            }}
                            onClick={() => handleMemberSort('created_at')}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              Added
                              {renderMemberSortIcon('created_at')}
                            </span>
                          </th>

                          {/* Action */}
                          <th
                            className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-[0.12em] sm:px-6"
                            style={{
                              color:
                                'color-mix(in srgb, var(--portal-text) 55%, transparent)',
                            }}
                          >
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredAndSortedMembers.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-6 py-12 text-center"
                            >
                              <p
                                className="text-sm font-semibold"
                                style={{ color: 'var(--portal-text)' }}
                              >
                                No matching members
                              </p>

                              <p
                                className="mt-1 text-xs"
                                style={{
                                  color:
                                    'color-mix(in srgb, var(--portal-text) 52%, transparent)',
                                }}
                              >
                                Try changing your search or position filter.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          filteredAndSortedMembers.map((member) => {
                            const displayName =
                              member.name?.trim() || member.email;

                            const positionName =
                              positions.find(
                                (position) =>
                                  position.name.toLowerCase() ===
                                  member.role.toLowerCase(),
                              )?.name || member.role;

                            const isCurrentUser =
                              member.user_id === ownerUserId;

                            const isOwner =
                              member.role.toLowerCase().trim() === 'owner';

                            return (
                              <tr
                                key={member.user_id}
                                className="border-t transition-colors"
                                style={{
                                  borderColor: 'var(--portal-border)',
                                }}
                              >
                                {/* Member */}
                                <td className="px-5 py-4 sm:px-6">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div
                                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-xs font-bold"
                                      style={{
                                        background:
                                          'var(--portal-accent-soft)',
                                        borderColor:
                                          'var(--portal-border)',
                                        color: 'var(--portal-accent)',
                                      }}
                                    >
                                      {displayName
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>

                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p
                                          className="truncate text-sm font-semibold"
                                          style={{
                                            color: 'var(--portal-text)',
                                          }}
                                        >
                                          {displayName}
                                        </p>

                                        {isCurrentUser && (
                                          <span
                                            className="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold"
                                            style={{
                                              background:
                                                'var(--portal-accent-soft)',
                                              borderColor:
                                                'var(--portal-border)',
                                              color:
                                                'var(--portal-accent)',
                                            }}
                                          >
                                            You
                                          </span>
                                        )}
                                      </div>

                                      <p
                                        className="mt-0.5 truncate text-xs"
                                        style={{
                                          color:
                                            'color-mix(in srgb, var(--portal-text) 52%, transparent)',
                                        }}
                                      >
                                        {member.email}
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                {/* Position */}
                                <td className="px-4 py-4">
                                  <span
                                    className="inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                                    style={{
                                      background:
                                        'var(--portal-background)',
                                      borderColor:
                                        'var(--portal-border)',
                                      color: 'var(--portal-text)',
                                    }}
                                  >
                                    {positionName}
                                  </span>
                                </td>

                                {/* Added */}
                                <td className="px-4 py-4">
                                  <span
                                    className="text-xs"
                                    style={{
                                      color:
                                        'color-mix(in srgb, var(--portal-text) 65%, transparent)',
                                    }}
                                  >
                                    {new Date(
                                      member.created_at,
                                    ).toLocaleDateString()}
                                  </span>
                                </td>

                                {/* Action */}
                                <td className="px-5 py-4 text-right sm:px-6">
                                  {!isCurrentUser && !isOwner ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setManagingMember(member);
                                        setEditName(member.name || '');
                                        setEditRole(member.role || '');
                                        setResetPassword('');
                                        setMessage(null);
                                      }}
                                      className="nova-button rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition"
                                      style={{
                                        background:
                                          'var(--portal-surface)',
                                        borderColor:
                                          'var(--portal-border)',
                                        color:
                                          'var(--portal-text)',
                                      }}
                                    >
                                      Manage
                                    </button>
                                  ) : (
                                    <span
                                      className="text-[10px] font-medium"
                                      style={{
                                        color:
                                          'color-mix(in srgb, var(--portal-text) 42%, transparent)',
                                      }}
                                    >
                                      {isOwner ? 'Owner' : 'You'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer */}
                  <div
                    className="flex flex-col gap-2 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                    style={{
                      borderColor: 'var(--portal-border)',
                    }}
                  >
                    <span
                      className="text-[10px] font-semibold"
                      style={{
                        color:
                          'color-mix(in srgb, var(--portal-text) 50%, transparent)',
                      }}
                    >
                      Showing {filteredAndSortedMembers.length} of {members.length} members
                    </span>

                    <span
                      className="text-[10px]"
                      style={{
                        color:
                          'color-mix(in srgb, var(--portal-text) 40%, transparent)',
                      }}
                    >
                      Click a column header to sort
                    </span>
                  </div>
                </>
              )}
                          </section>
                        </div>

                        {/* ADD MEMBER */}

              <section
                className="xl:col-span-4 rounded-[28px] border p-6 shadow-sm"
                style={{
                  background: 'var(--portal-surface)',
                  color: 'var(--portal-text)',
                  borderColor: 'var(--portal-border)',
                }}
              >
                <div>
                  <p
                    className="text-[10px] uppercase tracking-[0.18em] font-black"
                    style={{ color: 'var(--portal-accent)' }}
                  >
                    New Account
                  </p>

                  <h3 className="mt-1 text-lg font-black">
                    Add Team Member
                  </h3>

                  <p
                    className="mt-2 text-sm leading-6"
                    style={{
                      color: 'var(--portal-text)',
                      opacity: 0.55,
                    }}
                  >
                    Create login credentials for a restaurant employee.
                  </p>
                </div>

                {positions.length === 0 ? (
                  <div
                    className="mt-6 rounded-2xl border p-4"
                    style={{
                      background: 'var(--portal-background)',
                      borderColor: 'var(--portal-border)',
                    }}
                  >
                    <p className="text-sm font-bold">
                      No positions available
                    </p>

                    <p
                      className="mt-1 text-xs leading-5"
                      style={{
                        color: 'var(--portal-text)',
                        opacity: 0.5,
                      }}
                    >
                      No team positions have been created for this restaurant yet.
                    </p>
                  </div>
                ) : (
                  <form
                    onSubmit={handleAddWorker}
                    className="mt-6 space-y-4"
                  >
                    <div>
                      <label
                        className="mb-2 block text-[10px] uppercase tracking-[0.14em] font-black"
                        style={{
                          color: 'var(--portal-text)',
                          opacity: 0.6,
                        }}
                      >
                        Full Name
                      </label>

                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                        style={{
                          background: 'var(--portal-background)',
                          color: 'var(--portal-text)',
                          borderColor: 'var(--portal-border)',
                          ['--tw-ring-color' as string]: 'var(--portal-accent)',
                        }}
                      />
                    </div>

                    <div>
                      <label
                        className="mb-2 block text-[10px] uppercase tracking-[0.14em] font-black"
                        style={{
                          color: 'var(--portal-text)',
                          opacity: 0.6,
                        }}
                      >
                        Email
                      </label>

                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="worker@restaurant.com"
                        className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                        style={{
                          background: 'var(--portal-background)',
                          color: 'var(--portal-text)',
                          borderColor: 'var(--portal-border)',
                          ['--tw-ring-color' as string]: 'var(--portal-accent)',
                        }}
                      />
                    </div>

                    <div>
                      <label
                        className="mb-2 block text-[10px] uppercase tracking-[0.14em] font-black"
                        style={{
                          color: 'var(--portal-text)',
                          opacity: 0.6,
                        }}
                      >
                        Temporary Password
                      </label>

                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                        style={{
                          background: 'var(--portal-background)',
                          color: 'var(--portal-text)',
                          borderColor: 'var(--portal-border)',
                          ['--tw-ring-color' as string]: 'var(--portal-accent)',
                        }}
                      />
                    </div>

                    <div>
                      <label
                        className="mb-2 block text-[10px] uppercase tracking-[0.14em] font-black"
                        style={{
                          color: 'var(--portal-text)',
                          opacity: 0.6,
                        }}
                      >
                        Position
                      </label>

                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        required
                        className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                        style={{
                          background: 'var(--portal-background)',
                          color: 'var(--portal-text)',
                          borderColor: 'var(--portal-border)',
                          ['--tw-ring-color' as string]: 'var(--portal-accent)',
                        }}
                      >
                        {positions.map((position) => (
                          <option
                            key={position.id}
                            value={position.name}
                            style={{
                              background: 'var(--portal-surface)',
                              color: 'var(--portal-text)',
                            }}
                          >
                            {position.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="nova-primary w-full rounded-xl py-3.5 text-xs font-black disabled:opacity-50"
                      style={{
                        background: 'var(--portal-accent)',
                        color: 'var(--portal-button-text, #FFFFFF)',
                      }}
                    >
                      {loading ? 'Creating Account...' : 'Create Team Account'}
                    </button>
                  </form>
                )}
              </section>
        </section>


        {/* ===================================================== */}
        {/* MANAGE POSITIONS */}
        {/* ===================================================== */}

        <section className="mt-8">
          <div
            className="rounded-[28px] border p-6 shadow-sm"
            style={{
              background: 'var(--portal-surface)',
              borderColor: 'var(--portal-border)',
              color: 'var(--portal-text)',
            }}
          >
            {/* HEADER */}

            <div>
              <p
                className="text-[10px] uppercase tracking-[0.18em] font-black"
                style={{ color: 'var(--portal-accent)' }}
              >
                Team Structure
              </p>

              <h3
                className="mt-1 text-xl font-black tracking-tight"
                style={{ color: 'var(--portal-text)' }}
              >
                Manage Positions
              </h3>

              <p
                className="mt-1.5 text-sm leading-6"
                style={{
                  color: 'var(--portal-text)',
                  opacity: 0.55,
                }}
              >
                Create and manage the positions used by your restaurant team.
              </p>
            </div>

            {/* ADD POSITION */}

            <div
              className="mt-6 rounded-2xl border p-5"
              style={{
                background: 'var(--portal-background)',
                borderColor: 'var(--portal-border)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p
                    className="text-xs font-black"
                    style={{ color: 'var(--portal-text)' }}
                  >
                    Create New Position
                  </p>

                  <p
                    className="mt-1 text-[11px]"
                    style={{
                      color: 'var(--portal-text)',
                      opacity: 0.5,
                    }}
                  >
                    Add a role that can be assigned to team members.
                  </p>
                </div>

                <span
                  className="hidden sm:inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold"
                  style={{
                    background: 'var(--portal-surface)',
                    borderColor: 'var(--portal-border)',
                    color: 'var(--portal-accent)',
                  }}
                >
                  {positions.length} {positions.length === 1 ? 'position' : 'positions'}
                </span>
              </div>

              <form
                onSubmit={handleAddPosition}
                className="mt-4 flex flex-col gap-3 sm:flex-row"
              >
                <input
                  type="text"
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  placeholder="e.g. Waiter, Cashier, Manager"
                  className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                  style={{
                    background: 'var(--portal-surface)',
                    color: 'var(--portal-text)',
                    borderColor: 'var(--portal-border)',
                    ['--tw-ring-color' as string]: 'var(--portal-accent)',
                  }}
                />

                <button
                  type="submit"
                  disabled={addingPosition || !newPosition.trim()}
                  className="nova-primary shrink-0 rounded-xl px-6 py-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    background: 'var(--portal-accent)',
                    color: 'var(--portal-button-text, #FFFFFF)',
                  }}
                >
                  {addingPosition ? 'Adding...' : 'Add Position'}
                </button>
              </form>
            </div>

            {/* POSITION LIST */}

            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p
                    className="text-xs font-black"
                    style={{ color: 'var(--portal-text)' }}
                  >
                    Restaurant Positions
                  </p>

                  <p
                    className="mt-0.5 text-[10px]"
                    style={{
                      color: 'var(--portal-text)',
                      opacity: 0.45,
                    }}
                  >
                    Configure access and manage your team structure.
                  </p>
                </div>

                <span
                  className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg border px-2 text-[10px] font-black"
                  style={{
                    background: 'var(--portal-accent-soft)',
                    borderColor: 'var(--portal-border)',
                    color: 'var(--portal-accent)',
                  }}
                >
                  {positions.length}
                </span>
              </div>

              {positions.length === 0 ? (
                <div
                  className="rounded-2xl border border-dashed px-6 py-10 text-center"
                  style={{
                    background: 'var(--portal-background)',
                    borderColor: 'var(--portal-border)',
                  }}
                >
                  <div
                    className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border"
                    style={{
                      background: 'var(--portal-surface)',
                      borderColor: 'var(--portal-border)',
                      color: 'var(--portal-accent)',
                    }}
                  >
                    <BriefcaseBusiness className="h-5 w-5" />
                  </div>

                  <p
                    className="mt-4 text-sm font-black"
                    style={{ color: 'var(--portal-text)' }}
                  >
                    No positions yet
                  </p>

                  <p
                    className="mt-1 text-xs"
                    style={{
                      color: 'var(--portal-text)',
                      opacity: 0.5,
                    }}
                  >
                    Create your first position above.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {positions.map((position) => {
                    const memberCount = members.filter(
                      (member) =>
                        member.role.toLowerCase() ===
                        position.name.toLowerCase(),
                    ).length;

                    return (
                      <div
                        key={position.id}
                        className="rounded-2xl border p-4 transition-colors"
                        style={{
                          background: 'var(--portal-background)',
                          borderColor: 'var(--portal-border)',
                        }}
                      >
                        {/* POSITION HEADER */}

                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-xs font-black"
                              style={{
                                background: 'var(--portal-accent-soft)',
                                borderColor: 'var(--portal-border)',
                                color: 'var(--portal-accent)',
                              }}
                            >
                              {position.name
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div className="min-w-0">
                              <p
                                className="truncate text-sm font-black"
                                style={{ color: 'var(--portal-text)' }}
                              >
                                {position.name}
                              </p>

                              <p
                                className="mt-0.5 text-[10px]"
                                style={{
                                  color: 'var(--portal-text)',
                                  opacity: 0.45,
                                }}
                              >
                                {memberCount}{' '}
                                {memberCount === 1 ? 'member' : 'members'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* ACTIONS */}

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => openPermissions(position)}
                            className="nova-button rounded-lg border px-2 py-2.5 text-[10px] font-bold transition"
                            style={{
                              background: 'var(--portal-surface)',
                              borderColor: 'var(--portal-border)',
                              color: 'var(--portal-accent)',
                            }}
                          >
                            Access
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingPosition(position);
                              setEditingPositionName(position.name);
                              setMessage(null);
                            }}
                            className="nova-button rounded-lg border px-2 py-2.5 text-[10px] font-bold transition"
                            style={{
                              background: 'var(--portal-surface)',
                              borderColor: 'var(--portal-border)',
                              color: 'var(--portal-text)',
                            }}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            disabled={deletingPositionId === position.id}
                            onClick={() => handleDeletePosition(position)}
                            className="nova-danger rounded-lg border px-2 py-2.5 text-[10px] font-bold transition disabled:opacity-50"
                            style={{
                              background: 'var(--portal-surface)',
                              borderColor: 'var(--portal-border)',
                              color: '#A85C4A',
                            }}
                          >
                            {deletingPositionId === position.id
                              ? '...'
                              : 'Delete'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ===================================================== */}
        {/* MANAGE MEMBER MODAL */}
        {/* ===================================================== */}

        {managingMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <button
              type="button"
              aria-label="Close"
              onClick={closeManageMember}
              className="absolute inset-0 cursor-default"
              style={{
                background:
                  'color-mix(in srgb, var(--portal-text) 42%, transparent)',
                backdropFilter: 'blur(6px)',
              }}
            />

            {/* Modal */}
            <div
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[24px] border shadow-2xl"
              style={{
                background: 'var(--portal-surface)',
                color: 'var(--portal-text)',
                borderColor: 'var(--portal-border)',
              }}
            >
              {/* HEADER */}

              <div
                className="flex items-start justify-between gap-4 border-b px-6 py-5"
                style={{ borderColor: 'var(--portal-border)' }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm font-black"
                    style={{
                      background: 'var(--portal-accent-soft)',
                      borderColor: 'var(--portal-border)',
                      color: 'var(--portal-accent)',
                    }}
                  >
                    {(managingMember.name?.trim() || managingMember.email)
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <p
                      className="text-[9px] uppercase tracking-[0.16em] font-black"
                      style={{ color: 'var(--portal-accent)' }}
                    >
                      Team Member
                    </p>

                    <h3
                      className="mt-1 truncate text-lg font-black tracking-tight"
                      style={{ color: 'var(--portal-text)' }}
                    >
                      Manage Account
                    </h3>

                    <p
                      className="mt-0.5 truncate text-xs"
                      style={{
                        color: 'var(--portal-text)',
                        opacity: 0.5,
                      }}
                    >
                      {managingMember.email}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeManageMember}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-lg font-medium transition"
                  style={{
                    background: 'var(--portal-background)',
                    borderColor: 'var(--portal-border)',
                    color: 'var(--portal-text)',
                  }}
                >
                  ×
                </button>
              </div>

              {/* CONTENT */}

              <div className="space-y-7 p-6">

                {/* PROFILE */}

                <section>
                  <div className="mb-3">
                    <p
                      className="text-[10px] uppercase tracking-[0.14em] font-black"
                      style={{ color: 'var(--portal-accent)' }}
                    >
                      Profile
                    </p>

                    <p
                      className="mt-1 text-xs"
                      style={{
                        color: 'var(--portal-text)',
                        opacity: 0.5,
                      }}
                    >
                      Update this team member's basic information.
                    </p>
                  </div>

                  {/* NAME */}

                  <div>
                    <label
                      className="mb-2 block text-[10px] uppercase tracking-[0.12em] font-black"
                      style={{
                        color: 'var(--portal-text)',
                        opacity: 0.6,
                      }}
                    >
                      Full Name
                    </label>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Team member name"
                        className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                        style={{
                          background: 'var(--portal-background)',
                          color: 'var(--portal-text)',
                          borderColor: 'var(--portal-border)',
                          ['--tw-ring-color' as string]:
                            'var(--portal-accent)',
                        }}
                      />

                      <button
                        type="button"
                        onClick={handleUpdateName}
                        disabled={
                          savingName ||
                          !editName.trim() ||
                          editName.trim() ===
                            (managingMember.name || '').trim()
                        }
                        className="nova-primary shrink-0 rounded-xl px-4 py-3 text-[10px] font-black disabled:opacity-40"
                        style={{
                          background: 'var(--portal-accent)',
                          color: 'var(--portal-button-text, #FFFFFF)',
                        }}
                      >
                        {savingName ? 'Saving...' : 'Save Name'}
                      </button>
                    </div>
                  </div>

                  {/* POSITION */}

                  <div className="mt-5">
                    <label
                      className="mb-2 block text-[10px] uppercase tracking-[0.12em] font-black"
                      style={{
                        color: 'var(--portal-text)',
                        opacity: 0.6,
                      }}
                    >
                      Position
                    </label>

                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                      style={{
                        background: 'var(--portal-background)',
                        color: 'var(--portal-text)',
                        borderColor: 'var(--portal-border)',
                        ['--tw-ring-color' as string]:
                          'var(--portal-accent)',
                      }}
                    >
                      {positions.map((position) => (
                        <option key={position.id} value={position.name}>
                          {position.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleUpdateRole}
                      disabled={
                        savingRole ||
                        !editRole ||
                        editRole === managingMember.role
                      }
                      className="nova-primary mt-3 w-full rounded-xl py-3 text-xs font-black disabled:opacity-50"
                      style={{
                        background: 'var(--portal-accent)',
                        color: 'var(--portal-button-text, #FFFFFF)',
                      }}
                    >
                      {savingRole ? 'Saving...' : 'Save Position'}
                    </button>
                  </div>
                </section>

                {/* SECURITY */}

                <section
                  className="border-t pt-6"
                  style={{ borderColor: 'var(--portal-border)' }}
                >
                  <div className="mb-3">
                    <p
                      className="text-[10px] uppercase tracking-[0.14em] font-black"
                      style={{ color: 'var(--portal-accent)' }}
                    >
                      Security
                    </p>

                    <p
                      className="mt-1 text-xs"
                      style={{
                        color: 'var(--portal-text)',
                        opacity: 0.5,
                      }}
                    >
                      Reset the login password for this account.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="password"
                      minLength={6}
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="New password"
                      className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                      style={{
                        background: 'var(--portal-background)',
                        color: 'var(--portal-text)',
                        borderColor: 'var(--portal-border)',
                        ['--tw-ring-color' as string]:
                          'var(--portal-accent)',
                      }}
                    />

                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={
                        resettingPassword ||
                        resetPassword.length < 6
                      }
                      className="nova-button shrink-0 rounded-xl border px-5 py-3 text-[10px] font-black disabled:opacity-40"
                      style={{
                        background: 'var(--portal-background)',
                        borderColor: 'var(--portal-border)',
                        color: 'var(--portal-accent)',
                      }}
                    >
                      {resettingPassword ? '...' : 'Reset Password'}
                    </button>
                  </div>
                </section>

                {/* DANGER ZONE */}

                <section
                  className="border-t pt-6"
                  style={{ borderColor: 'var(--portal-border)' }}
                >
                  <div>
                    <p
                      className="text-[10px] uppercase tracking-[0.14em] font-black"
                      style={{ color: '#A85C4A' }}
                    >
                      Danger Zone
                    </p>

                    <p
                      className="mt-1 text-xs leading-5"
                      style={{
                        color: 'var(--portal-text)',
                        opacity: 0.5,
                      }}
                    >
                      Permanently remove this account from the restaurant.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDeleteMember}
                    disabled={deletingMember}
                    className="nova-danger mt-4 w-full rounded-xl border py-3 text-xs font-black transition disabled:opacity-50"
                    style={{
                      background: 'var(--portal-background)',
                      borderColor: 'color-mix(in srgb, #A85C4A 35%, var(--portal-border))',
                      color: '#A85C4A',
                    }}
                  >
                    {deletingMember
                      ? 'Removing Account...'
                      : 'Remove Team Member'}
                  </button>
                </section>
              </div>

              {/* FOOTER */}

              <div
                className="border-t px-6 py-4"
                style={{ borderColor: 'var(--portal-border)' }}
              >
                <button
                  type="button"
                  onClick={closeManageMember}
                  className="nova-button w-full rounded-xl border py-3 text-xs font-bold transition"
                  style={{
                    background: 'var(--portal-background)',
                    borderColor: 'var(--portal-border)',
                    color: 'var(--portal-text)',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* EDIT POSITION MODAL */}
        {/* ===================================================== */}

        {editingPosition && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Overlay */}
            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                setEditingPosition(null);
                setEditingPositionName('');
              }}
              className="absolute inset-0 cursor-default"
              style={{
                background:
                  'color-mix(in srgb, var(--portal-text) 42%, transparent)',
                backdropFilter: 'blur(6px)',
              }}
            />

            {/* Modal */}
            <div
              className="relative w-full max-w-md overflow-hidden rounded-[24px] border shadow-2xl"
              style={{
                background: 'var(--portal-surface)',
                color: 'var(--portal-text)',
                borderColor: 'var(--portal-border)',
              }}
            >
              {/* HEADER */}

              <div
                className="flex items-start justify-between gap-4 border-b px-6 py-5"
                style={{ borderColor: 'var(--portal-border)' }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm font-black"
                    style={{
                      background: 'var(--portal-accent-soft)',
                      borderColor: 'var(--portal-border)',
                      color: 'var(--portal-accent)',
                    }}
                  >
                    {editingPosition.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <p
                      className="text-[9px] uppercase tracking-[0.16em] font-black"
                      style={{ color: 'var(--portal-accent)' }}
                    >
                      Team Structure
                    </p>

                    <h3
                      className="mt-1 text-lg font-black tracking-tight"
                      style={{ color: 'var(--portal-text)' }}
                    >
                      Edit Position
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingPosition(null);
                    setEditingPositionName('');
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-lg font-medium transition"
                  style={{
                    background: 'var(--portal-background)',
                    borderColor: 'var(--portal-border)',
                    color: 'var(--portal-text)',
                  }}
                >
                  ×
                </button>
              </div>

              {/* CONTENT */}

              <div className="p-6">
                <p
                  className="text-xs leading-5"
                  style={{
                    color: 'var(--portal-text)',
                    opacity: 0.55,
                  }}
                >
                  Rename this position. Existing team members assigned to
                  this position will keep their assignment under the new name.
                </p>

                {/* POSITION NAME */}

                <div className="mt-6">
                  <label
                    className="mb-2 block text-[10px] uppercase tracking-[0.12em] font-black"
                    style={{
                      color: 'var(--portal-text)',
                      opacity: 0.6,
                    }}
                  >
                    Position Name
                  </label>

                  <input
                    type="text"
                    autoFocus
                    value={editingPositionName}
                    onChange={(e) => setEditingPositionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSavePosition();
                      }
                    }}
                    placeholder="e.g. Manager"
                    className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                    style={{
                      background: 'var(--portal-background)',
                      color: 'var(--portal-text)',
                      borderColor: 'var(--portal-border)',
                      ['--tw-ring-color' as string]:
                        'var(--portal-accent)',
                    }}
                  />
                </div>

                {/* ACTIONS */}

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPosition(null);
                      setEditingPositionName('');
                    }}
                    className="nova-button flex-1 rounded-xl border py-3 text-xs font-bold transition"
                    style={{
                      background: 'var(--portal-background)',
                      borderColor: 'var(--portal-border)',
                      color: 'var(--portal-text)',
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSavePosition}
                    disabled={
                      savingPosition ||
                      !editingPositionName.trim() ||
                      editingPositionName.trim() === editingPosition.name
                    }
                    className="nova-primary flex-1 rounded-xl py-3 text-xs font-black transition disabled:opacity-40"
                    style={{
                      background: 'var(--portal-accent)',
                      color: 'var(--portal-button-text, #FFFFFF)',
                    }}
                  >
                    {savingPosition ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* PERMISSIONS MODAL */}
        {/* ===================================================== */}

        {editingPermissions && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            {/* Overlay */}
            <button
              type="button"
              aria-label="Close"
              onClick={() => setEditingPermissions(null)}
              className="absolute inset-0 cursor-default"
              style={{
                background:
                  'color-mix(in srgb, var(--portal-text) 42%, transparent)',
                backdropFilter: 'blur(6px)',
              }}
            />

            {/* Modal */}
            <div
              className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[24px] border shadow-2xl"
              style={{
                background: 'var(--portal-surface)',
                color: 'var(--portal-text)',
                borderColor: 'var(--portal-border)',
              }}
            >
              {/* HEADER */}

              <div
                className="flex items-start justify-between gap-4 border-b px-6 py-5"
                style={{ borderColor: 'var(--portal-border)' }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm font-black"
                    style={{
                      background: 'var(--portal-accent-soft)',
                      borderColor: 'var(--portal-border)',
                      color: 'var(--portal-accent)',
                    }}
                  >
                    A
                  </div>

                  <div className="min-w-0">
                    <p
                      className="text-[9px] uppercase tracking-[0.16em] font-black"
                      style={{ color: 'var(--portal-accent)' }}
                    >
                      Access Control
                    </p>

                    <h3
                      className="mt-1 truncate text-lg font-black tracking-tight"
                      style={{ color: 'var(--portal-text)' }}
                    >
                      {editingPermissions.name}
                    </h3>

                    <p
                      className="mt-0.5 text-xs"
                      style={{
                        color: 'var(--portal-text)',
                        opacity: 0.5,
                      }}
                    >
                      Configure what this position can access.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingPermissions(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-lg font-medium transition"
                  style={{
                    background: 'var(--portal-background)',
                    borderColor: 'var(--portal-border)',
                    color: 'var(--portal-text)',
                  }}
                >
                  ×
                </button>
              </div>

              {/* PERMISSIONS */}

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-2.5">
                  {/* DASHBOARD */}

                  <label
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition-colors"
                    style={{
                      background: 'var(--portal-background)',
                      borderColor: 'var(--portal-border)',
                    }}
                  >
                    <div className="min-w-0">
                      <p
                        className="text-sm font-bold"
                        style={{ color: 'var(--portal-text)' }}
                      >
                        Dashboard
                      </p>

                      <p
                        className="mt-0.5 text-[11px]"
                        style={{
                          color: 'var(--portal-text)',
                          opacity: 0.5,
                        }}
                      >
                        View the restaurant dashboard.
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={permissionValues.can_view_dashboard}
                      onChange={(e) =>
                        setPermissionValues((prev) => ({
                          ...prev,
                          can_view_dashboard: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 shrink-0 cursor-pointer"
                      style={{ accentColor: 'var(--portal-accent)' }}
                    />
                  </label>

                  {/* MENU MANAGEMENT */}

                  <label
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition-colors"
                    style={{
                      background: 'var(--portal-background)',
                      borderColor: 'var(--portal-border)',
                    }}
                  >
                    <div className="min-w-0">
                      <p
                        className="text-sm font-bold"
                        style={{ color: 'var(--portal-text)' }}
                      >
                        Menu Management
                      </p>

                      <p
                        className="mt-0.5 text-[11px]"
                        style={{
                          color: 'var(--portal-text)',
                          opacity: 0.5,
                        }}
                      >
                        Create and edit menu items.
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={permissionValues.can_manage_menu}
                      onChange={(e) =>
                        setPermissionValues((prev) => ({
                          ...prev,
                          can_manage_menu: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 shrink-0 cursor-pointer"
                      style={{ accentColor: 'var(--portal-accent)' }}
                    />
                  </label>

                  {/* PRICING */}

                  <label
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition-colors"
                    style={{
                      background: 'var(--portal-background)',
                      borderColor: 'var(--portal-border)',
                    }}
                  >
                    <div className="min-w-0">
                      <p
                        className="text-sm font-bold"
                        style={{ color: 'var(--portal-text)' }}
                      >
                        Pricing & Promotions
                      </p>

                      <p
                        className="mt-0.5 text-[11px]"
                        style={{
                          color: 'var(--portal-text)',
                          opacity: 0.5,
                        }}
                      >
                        Manage restaurant pricing rules and promotions.
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={permissionValues.can_manage_pricing}
                      onChange={(e) =>
                        setPermissionValues((prev) => ({
                          ...prev,
                          can_manage_pricing: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 shrink-0 cursor-pointer"
                      style={{ accentColor: 'var(--portal-accent)' }}
                    />
                  </label>

                  {/* QR STUDIO */}

                  <label
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition-colors"
                    style={{
                      background: 'var(--portal-background)',
                      borderColor: 'var(--portal-border)',
                    }}
                  >
                    <div className="min-w-0">
                      <p
                        className="text-sm font-bold"
                        style={{ color: 'var(--portal-text)' }}
                      >
                        QR Studio
                      </p>

                      <p
                        className="mt-0.5 text-[11px]"
                        style={{
                          color: 'var(--portal-text)',
                          opacity: 0.5,
                        }}
                      >
                        Create and customize restaurant QR codes.
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={permissionValues.can_manage_qr_studio}
                      onChange={(e) =>
                        setPermissionValues((prev) => ({
                          ...prev,
                          can_manage_qr_studio: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 shrink-0 cursor-pointer"
                      style={{ accentColor: 'var(--portal-accent)' }}
                    />
                  </label>

                  {/* ORDERS */}

                  <label
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition-colors"
                    style={{
                      background: 'var(--portal-background)',
                      borderColor: 'var(--portal-border)',
                    }}
                  >
                    <div className="min-w-0">
                      <p
                        className="text-sm font-bold"
                        style={{ color: 'var(--portal-text)' }}
                      >
                        Orders
                      </p>

                      <p
                        className="mt-0.5 text-[11px]"
                        style={{
                          color: 'var(--portal-text)',
                          opacity: 0.5,
                        }}
                      >
                        View and manage restaurant orders.
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={permissionValues.can_manage_orders}
                      onChange={(e) =>
                        setPermissionValues((prev) => ({
                          ...prev,
                          can_manage_orders: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 shrink-0 cursor-pointer"
                      style={{ accentColor: 'var(--portal-accent)' }}
                    />
                  </label>

                  {/* TEAM */}

                  <label
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition-colors"
                    style={{
                      background: 'var(--portal-background)',
                      borderColor: 'var(--portal-border)',
                    }}
                  >
                    <div className="min-w-0">
                      <p
                        className="text-sm font-bold"
                        style={{ color: 'var(--portal-text)' }}
                      >
                        Team Management
                      </p>

                      <p
                        className="mt-0.5 text-[11px]"
                        style={{
                          color: 'var(--portal-text)',
                          opacity: 0.5,
                        }}
                      >
                        Manage team members and positions.
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={permissionValues.can_manage_team}
                      onChange={(e) =>
                        setPermissionValues((prev) => ({
                          ...prev,
                          can_manage_team: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 shrink-0 cursor-pointer"
                      style={{ accentColor: 'var(--portal-accent)' }}
                    />
                  </label>

                  {/* SETTINGS */}

                  <label
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition-colors"
                    style={{
                      background: 'var(--portal-background)',
                      borderColor: 'var(--portal-border)',
                    }}
                  >
                    <div className="min-w-0">
                      <p
                        className="text-sm font-bold"
                        style={{ color: 'var(--portal-text)' }}
                      >
                        Restaurant Settings
                      </p>

                      <p
                        className="mt-0.5 text-[11px]"
                        style={{
                          color: 'var(--portal-text)',
                          opacity: 0.5,
                        }}
                      >
                        Change restaurant configuration.
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={permissionValues.can_manage_settings}
                      onChange={(e) =>
                        setPermissionValues((prev) => ({
                          ...prev,
                          can_manage_settings: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 shrink-0 cursor-pointer"
                      style={{ accentColor: 'var(--portal-accent)' }}
                    />
                  </label>
                </div>
              </div>

              {/* FOOTER */}

              <div
                className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row"
                style={{ borderColor: 'var(--portal-border)' }}
              >
                <button
                  type="button"
                  onClick={() => setEditingPermissions(null)}
                  className="nova-button flex-1 rounded-xl border py-3 text-xs font-bold transition"
                  style={{
                    background: 'var(--portal-background)',
                    borderColor: 'var(--portal-border)',
                    color: 'var(--portal-text)',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={savingPermissions}
                  className="nova-primary flex-1 rounded-xl py-3 text-xs font-black transition disabled:opacity-40"
                  style={{
                    background: 'var(--portal-accent)',
                    color: 'var(--portal-button-text, #FFFFFF)',
                  }}
                >
                  {savingPermissions ? 'Saving...' : 'Save Access'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}

        <footer className="px-4 pb-8 pt-2 sm:px-6 lg:px-8">
          <div
            className="mx-auto flex max-w-[1400px] items-center justify-between border-t pt-5"
            style={{ borderColor: 'var(--portal-border)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-md border text-[9px] font-black"
                style={{
                  background: 'var(--portal-accent-soft)',
                  borderColor: 'var(--portal-border)',
                  color: 'var(--portal-accent)',
                }}
              >
                N
              </div>

              <span
                className="text-[9px] font-black tracking-[0.16em]"
                style={{
                  color: 'var(--portal-text)',
                  opacity: 0.55,
                }}
              >
                NOVAMENU
              </span>
            </div>

            <p
              className="text-[9px]"
              style={{
                color: 'var(--portal-text)',
                opacity: 0.4,
              }}
            >
              Team workspace
            </p>
          </div>
        </footer>

      </main>

      <style jsx global>{`
        @keyframes novaTeamIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        main {
          animation: novaTeamIn 0.35s ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>

    </div>
  );
}

<style jsx global>{`
  /* ===================================================== */
  /* NOVAMENU BUTTON SYSTEM */
  /* ===================================================== */

  .nova-button,
  .nova-primary,
  .nova-danger {
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      color 160ms ease,
      box-shadow 160ms ease,
      transform 160ms ease,
      opacity 160ms ease;
  }

  /* SECONDARY BUTTON */

  .nova-button:hover:not(:disabled) {
    border-color: var(--portal-accent) !important;
    color: var(--portal-accent) !important;
    background: var(--portal-accent-soft) !important;
    box-shadow: 0 3px 10px
      color-mix(in srgb, var(--portal-accent) 10%, transparent);
  }

  .nova-button:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: none;
  }

  /* PRIMARY BUTTON */

  .nova-primary:hover:not(:disabled) {
    background: color-mix(
      in srgb,
      var(--portal-accent) 88%,
      var(--portal-text)
    ) !important;

    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--portal-accent) 18%, transparent);

    transform: translateY(-1px);
  }

  .nova-primary:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: none;
  }

  /* DANGER BUTTON */

  .nova-danger:hover:not(:disabled) {
    background: color-mix(
      in srgb,
      #A85C4A 7%,
      var(--portal-background)
    ) !important;

    border-color: color-mix(
      in srgb,
      #A85C4A 50%,
      var(--portal-border)
    ) !important;

    box-shadow: 0 3px 10px
      color-mix(in srgb, #A85C4A 10%, transparent);
  }

  .nova-danger:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: none;
  }

  /* DISABLED */

  .nova-button:disabled,
  .nova-primary:disabled,
  .nova-danger:disabled {
    cursor: not-allowed;
    opacity: 0.45;
    transform: none !important;
    box-shadow: none !important;
  }

  /* INPUTS */

  input::placeholder,
  textarea::placeholder {
    color: color-mix(
      in srgb,
      var(--portal-text) 38%,
      transparent
    );
  }

  select option {
    background: var(--portal-surface);
    color: var(--portal-text);
  }

  /* MOBILE */

  @media (max-width: 640px) {
    .nova-button:hover:not(:disabled),
    .nova-primary:hover:not(:disabled),
    .nova-danger:hover:not(:disabled) {
      transform: none;
    }
  }
`}</style>