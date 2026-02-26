/**
 * Diary-related TypeScript types — mirrors backend Pydantic schemas.
 */

export interface DiaryAuthor {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface DiaryMilestone {
  id: string;
  title: string;
  status: string;
}

export interface DiaryEntryResponse {
  id: string;
  workspace_id: string;
  author: DiaryAuthor;
  milestone: DiaryMilestone | null;
  entry_date: string;
  hours_worked: number | null;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface StreakInfo {
  user_id: string;
  display_name: string;
  current_streak: number;
  logged_today: boolean;
}

export interface StreaksResponse {
  streaks: StreakInfo[];
}

// ── Request payloads ────────────────────────────────────────

export interface DiaryEntryCreatePayload {
  entry_date: string;
  milestone_id?: string | null;
  hours_worked?: number | null;
  description: string;
}

export interface DiaryEntryUpdatePayload {
  entry_date?: string;
  milestone_id?: string | null;
  hours_worked?: number | null;
  description?: string;
}

