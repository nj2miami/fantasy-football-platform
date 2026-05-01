export const FREE_LEAGUE_MIN_TEAMS = 4;
export const FREE_LEAGUE_MAX_TEAMS = 8;
export const PAID_LEAGUE_MIN_TEAMS = 4;
export const PAID_LEAGUE_MAX_TEAMS = 16;
export const FREE_MANAGER_LEAGUE_LIMIT = 1;
export const PREMIUM_LEAGUE_LIMIT = 4;

export function userRole(user) {
  return String(user?.role || "manager").toLowerCase();
}

export function isAdmin(user) {
  return userRole(user) === "admin";
}

export function isPremium(user) {
  return userRole(user) === "premium";
}

export function activeHumanMemberships(memberships = []) {
  return memberships.filter((membership) => membership.is_active !== false && !membership.is_ai);
}

export function createdLeaguesForUser(user, leagues = []) {
  if (!user) return [];
  return leagues.filter((league) => (
    league.commissioner_id === user.id || league.commissioner_email === user.email
  ));
}

export function getLeagueEntitlements(user, memberships = [], leagues = []) {
  const role = userRole(user);
  const membershipCount = activeHumanMemberships(memberships).length;
  const createdCount = createdLeaguesForUser(user, leagues).length;

  if (role === "admin") {
    return {
      role,
      membershipCount,
      createdCount,
      canJoinLeague: true,
      canCreateFreeLeague: true,
      canCreatePaidLeague: true,
      membershipLimit: Infinity,
      createdLimit: Infinity,
      tag: "ADMIN",
    };
  }

  if (role === "premium") {
    const hasPremiumCapacity = membershipCount < PREMIUM_LEAGUE_LIMIT && createdCount < PREMIUM_LEAGUE_LIMIT;
    return {
      role,
      membershipCount,
      createdCount,
      canJoinLeague: membershipCount < PREMIUM_LEAGUE_LIMIT,
      canCreateFreeLeague: hasPremiumCapacity,
      canCreatePaidLeague: hasPremiumCapacity,
      membershipLimit: PREMIUM_LEAGUE_LIMIT,
      createdLimit: PREMIUM_LEAGUE_LIMIT,
      tag: "PREMIUM",
    };
  }

  return {
    role,
    membershipCount,
    createdCount,
    canJoinLeague: membershipCount < FREE_MANAGER_LEAGUE_LIMIT,
    canCreateFreeLeague: membershipCount === 0 && createdCount === 0,
    canCreatePaidLeague: membershipCount < PREMIUM_LEAGUE_LIMIT && createdCount < PREMIUM_LEAGUE_LIMIT,
    membershipLimit: FREE_MANAGER_LEAGUE_LIMIT,
    createdLimit: FREE_MANAGER_LEAGUE_LIMIT,
    tag: "MANAGER",
  };
}

export function leagueTeamLimits(leagueTier = "FREE") {
  return String(leagueTier).toUpperCase() === "PAID"
    ? { min: PAID_LEAGUE_MIN_TEAMS, max: PAID_LEAGUE_MAX_TEAMS }
    : { min: FREE_LEAGUE_MIN_TEAMS, max: FREE_LEAGUE_MAX_TEAMS };
}

export function validateLeagueTeamCount(leagueTier, maxMembers) {
  const { min, max } = leagueTeamLimits(leagueTier);
  if (maxMembers < min || maxMembers > max) {
    return `${String(leagueTier).toUpperCase()} leagues must have between ${min} and ${max} teams.`;
  }
  return null;
}
