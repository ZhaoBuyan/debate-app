// server/src/types/user.ts

export type UserRole = "user" | "admin" | "super_admin";

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  avatar: string;
  points: number;
  rank: string;
  wins: number;
  losses: number;
  is_banned: boolean;
  banned_reason: string | null;
  banned_at: number | null;
  banned_until: number | null;
  warning_count: number;
  last_login_ip: string | null;
  last_login_at: number | null;
  created_at: number;
}

export interface UserPublic {
  id: string;
  username: string;
  role: UserRole;
  avatar: string;
  rank: string;
  points: number;
  wins: number;
  losses: number;
}

export interface UserSession {
  id: string;
  username?: string;
  role?: UserRole;
  is_banned?: boolean;
}
