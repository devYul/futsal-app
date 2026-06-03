export type Role = "admin" | "member";
export type Position = "GK" | "DF" | "MF" | "FW" | null;
export type EventStatus = "upcoming" | "closed" | "done";
export type RsvpStatus = "yes" | "no" | "maybe";

export interface Profile {
  id: string;
  name: string;
  phone: string | null;
  position: Position;
  skill_rating: number;
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
  created_by: string | null;
  created_at: string;
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
}

export interface TeamAssignment {
  id: string;
  event_id: string;
  user_id: string;
  team_no: number;
  created_at: string;
}
