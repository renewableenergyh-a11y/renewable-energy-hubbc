// Shared role utilities for discussion system
// Purpose: define role hierarchy and helpers in one place

const ROLE_HIERARCHY = {
  superadmin: 4,
  admin: 3,
  instructor: 2,
  student: 1
};

/**
 * Normalize an incoming user-like object into the canonical authUser shape
 * Accepts objects or strings and returns an object with id, role, email, fullName, permissions
 */
function normalizeAuthUser(u) {
  if (!u) return null;

  // If passed a role string directly, wrap minimally
  if (typeof u === 'string') {
    return {
      id: u,
      role: 'student',
      email: '',
      fullName: '',
      permissions: []
    };
  }

  const id = u.id || u._id || u.userId || u.email || ('user_' + Math.random().toString(36).slice(2,8));
  const role = (u.role || 'student').toLowerCase();
  const email = u.email || '';
  const fullName = u.fullName || u.name || u.username || '';
  const permissions = u.permissions || [];

  return {
    id,
    role,
    email,
    fullName,
    permissions
  };
}

/**
 * Check whether a user (or role string) has at least the provided minimum role
 * Usage: hasAtLeastRole(userObjectOrRoleString, 'instructor')
 */
function hasAtLeastRole(userOrRole, minRole) {
  if (!minRole) return false;
  const required = ROLE_HIERARCHY[minRole];
  if (!required) return false;

  let roleVal = 0;
  if (!userOrRole) return false;

  if (typeof userOrRole === 'string') {
    roleVal = ROLE_HIERARCHY[userOrRole] || 0;
  } else if (typeof userOrRole === 'object') {
    const r = (userOrRole.role || '').toLowerCase();
    roleVal = ROLE_HIERARCHY[r] || 0;
  }

  return roleVal >= required;
}

module.exports = {
  ROLE_HIERARCHY,
  normalizeAuthUser,
  hasAtLeastRole
};
