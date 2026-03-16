/**
 * Tour step definitions for the guided onboarding experience.
 *
 * Each step targets a specific UI element (by key) and includes
 * the copy shown in the tooltip. Steps are ordered linearly
 * across all pages.
 */

export type TourPage =
  | "milestones"
  | "requests"
  | "diary"
  | "knowledge"
  | "settings";

export interface TourStep {
  targetKey: string;
  page: TourPage;
  title: string;
  description: string;
  /** Preferred tooltip position relative to the target */
  position: "top" | "bottom" | "left" | "right";
}

export const TOUR_STEPS: TourStep[] = [
  // ── Milestones ────────────────────────────────────────────
  {
    targetKey: "milestones-journey",
    page: "milestones",
    title: "Your Journey Path",
    description:
      "This is your project roadmap. Each phase represents a major chapter of your build — expand them to see individual milestones.",
    position: "bottom",
  },
  {
    targetKey: "milestones-phase-card",
    page: "milestones",
    title: "Phase Progress",
    description:
      "Track completion at a glance. The progress bar fills as you complete milestones within each phase.",
    position: "bottom",
  },
  {
    targetKey: "milestones-status-toggle",
    page: "milestones",
    title: "Update Status",
    description:
      "Tap any milestone's status icon to cycle through: Not Started, In Progress, and Completed.",
    position: "bottom",
  },
  {
    targetKey: "milestones-import",
    page: "milestones",
    title: "AI Import",
    description:
      "Paste your project plan or markdown and let AI automatically create phases and milestones for you.",
    position: "top",
  },

  // ── Requests ──────────────────────────────────────────────
  {
    targetKey: "requests-list",
    page: "requests",
    title: "Feature Requests",
    description:
      "Your team's idea board. Anyone in the workspace can submit feature ideas and track their status.",
    position: "bottom",
  },
  {
    targetKey: "requests-vote",
    page: "requests",
    title: "Vote on Ideas",
    description:
      "Tap the upvote arrow to signal which features matter most. Requests are ranked by vote count.",
    position: "bottom",
  },
  {
    targetKey: "requests-create",
    page: "requests",
    title: "Submit a Request",
    description:
      "Tap here to propose a new feature. Add a title and description to get the conversation started.",
    position: "top",
  },

  // ── Diary ─────────────────────────────────────────────────
  {
    targetKey: "diary-timeline",
    page: "diary",
    title: "Build Diary",
    description:
      "A reverse-chronological timeline of your work. Log what you built, learned, or decided each day.",
    position: "bottom",
  },
  {
    targetKey: "diary-streak",
    page: "diary",
    title: "Streaks",
    description:
      "Stay consistent. Your streak tracks consecutive days of diary entries — build momentum.",
    position: "bottom",
  },
  {
    targetKey: "diary-add",
    page: "diary",
    title: "New Entry",
    description:
      "Tap here to log today's progress. Include what you accomplished, blockers, and next steps.",
    position: "top",
  },

  // ── Knowledge ─────────────────────────────────────────────
  {
    targetKey: "knowledge-docs",
    page: "knowledge",
    title: "Knowledge Base",
    description:
      "Upload your project documents — specs, research, notes. They become searchable context for the AI assistant.",
    position: "bottom",
  },
  {
    targetKey: "knowledge-upload",
    page: "knowledge",
    title: "Upload Documents",
    description:
      "Drag or tap to upload PDFs, markdown, text files and more. Documents are chunked and embedded for AI retrieval.",
    position: "top",
  },
  {
    targetKey: "knowledge-chat",
    page: "knowledge",
    title: "AI Assistant",
    description:
      "Chat with an AI that has read all your uploaded documents. Ask questions, get summaries, brainstorm ideas.",
    position: "top",
  },

  // ── Settings ──────────────────────────────────────────────
  {
    targetKey: "settings-workspace",
    page: "settings",
    title: "Workspace Settings",
    description:
      "Manage your workspace name, invite team members, and switch between workspaces.",
    position: "bottom",
  },
  {
    targetKey: "settings-api-keys",
    page: "settings",
    title: "API Keys",
    description:
      "Connect your own OpenAI or Anthropic API key to power the AI features. Keys are encrypted at rest.",
    position: "bottom",
  },
  {
    targetKey: "settings-brief",
    page: "settings",
    title: "Project Brief",
    description:
      "Give the AI context about your project. This brief is injected into every AI conversation for better answers.",
    position: "top",
  },
];
