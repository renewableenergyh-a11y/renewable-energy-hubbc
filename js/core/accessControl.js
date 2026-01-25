import { getCurrentUser } from "./auth.js";

export function canAccessModule(module) {
  const user = getCurrentUser();
  if (!module.isPremium) return true;
  if (!user.isLoggedIn) return false;
  return user.hasPremium;
}
