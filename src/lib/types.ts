export type Role = "admin" | "member";
export type Position = "GK" | "DF" | "MF" | "FW" | null;
export type Gender = "M" | "F" | null;
export type EventStatus = "upcoming" | "closed" | "done";
export type RsvpStatus = "yes" | "no" | "maybe";

export interface Profile {
  id: string;
  name: string;
  phone: string | null;
  position: Position;
  gender: Gender;
  skill_rating: number;
  elo_rating: number;
  role: Role;
  created_at: string;
}

export interface FutsalEvent {
  id: string;
  title: string;
  location: string | null;
  starts_at: string;
  capacity: number | null;
  num_teams: number;
  status: EventStatus;
  mvp_user_id: string | null;
  series_id: string | null;
  rsvp_deadline: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Match {
  id: string;
  event_id: string;
  team_a: number;
  team_b: number;
  score_a: number;
  score_b: number;
  created_at: string;
}

export interface Dues {
  id: string;
  user_id: string;
  period: string; // 'YYYY-MM'
  amount: number;
  paid: boolean;
  paid_at: string | null;
  note: string | null;
}

export interface Rsvp {
  id: string;
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  updated_at: string;
}

export interface Attendance {
  id: string;
  event_id: string;
  user_id: string;
  checked_in_at: string;
  is_late: boolean;
}

export interface TeamAssignment {
  id: string;
  event_id: string;
  user_id: string;
  team_no: number;
  created_at: string;
}
