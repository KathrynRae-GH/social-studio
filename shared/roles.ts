// Who can do what in a brand's tab. Shared by the server (which decides)
// and the web app (which only uses it to show or hide buttons).

export type Role = "boutiqly_team" | "owner" | "team" | "none";

// What a sub-account user can be on a brand's Team list.
export type TeamRole = "owner" | "team";

export const ROLE_LABELS: Record<Role, string> = {
  boutiqly_team: "Boutiqly team",
  owner: "Account owner",
  team: "Team member",
  none: "No access yet",
};

// Agency users are Boutiqly's own team: full access to every brand for now.
// Everyone else needs a place on the brand's Team list. Nobody becomes an
// owner automatically: Boutiqly's team names the owner (decided Oct 3, 2026).
export function resolveRole(input: { isAgencyUser: boolean; teamRole: TeamRole | null }): Role {
  if (input.isAgencyUser) return "boutiqly_team";
  if (input.teamRole === "owner") return "owner";
  if (input.teamRole === "team") return "team";
  return "none";
}

export type Permission =
  | "use_tab" // see the screens, create, edit, approve, schedule
  | "manage_team" // add or remove people on the Team list. Only Boutiqly's team
  //               can name a brand's first owner, since no owner exists before that
  | "manage_brand"; // brand doc, style set, onboarding

const PERMISSIONS: Record<Role, Permission[]> = {
  boutiqly_team: ["use_tab", "manage_team", "manage_brand"],
  owner: ["use_tab", "manage_team", "manage_brand"],
  team: ["use_tab"],
  none: [],
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission);
}

// The signed-in person as the web app sees them.
export interface Me {
  user: { id: string; name: string; email: string };
  role: Role;
  roleLabel: string;
  brand: { id: string; name: string | null; locationId: string; hasOwner: boolean } | null;
  permissions: Permission[];
}

export interface TeamEntry {
  userId: string;
  name: string;
  email: string;
  role: TeamRole | "requested" | "candidate";
  requestedAt?: string;
}
