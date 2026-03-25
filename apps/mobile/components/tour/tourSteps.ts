/**
 * Tour step definitions for the guided onboarding experience.
 *
 * Each step targets a specific UI element (by key) and includes
 * educational copy that teaches the user what the feature does
 * and why it matters.
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
  position: "top" | "bottom" | "left" | "right";
  /** If set, navigate to this route when the step becomes active. */
  navigateTo?: string;
}

export const PAGE_ROUTES: Record<TourPage, string> = {
  milestones: "/(tabs)/milestones",
  requests: "/(tabs)/features",
  diary: "/(tabs)/diary",
  knowledge: "/(tabs)/knowledge",
  settings: "/(tabs)/settings",
};

export const TOUR_STEPS: TourStep[] = [
  // ── Milestones ────────────────────────────────────────────
  {
    targetKey: "milestones-journey",
    page: "milestones",
    title: "Welcome to Your Milestone Map",
    description:
      "This is the heart of FoundersForge. Your milestone map breaks your entire project into Phases (big chapters) and Milestones (individual tasks). Think of it as your founder's roadmap. You'll always know exactly where you stand and what's next.",
    position: "bottom",
  },
  {
    targetKey: "milestones-phase-card",
    page: "milestones",
    title: "Phases & Progress Tracking",
    description:
      "Each phase card shows your completion percentage. Tap a phase to expand it and see every milestone inside. As you mark milestones complete, the progress bar fills automatically, giving you a real-time view of momentum.",
    position: "bottom",
  },
  {
    targetKey: "milestones-status-toggle",
    page: "milestones",
    title: "Track Progress & Use AI",
    description:
      "Tap any milestone to cycle its status: Not Started, In Progress, and Completed. Each milestone also has its own AI-powered chat for brainstorming and problem-solving. You can also import an entire milestone map using AI. Scroll down and tap \"Import with AI\" to paste a project plan or description, and the AI generates your roadmap automatically.",
    position: "bottom",
  },

  // ── Requests ──────────────────────────────────────────────
  {
    targetKey: "requests-list",
    page: "requests",
    title: "Feature Request Board",
    description:
      "This is your team's idea hub. Anyone in the workspace can submit feature requests and track their status. Use this to capture user feedback, prioritize your backlog, and keep your team aligned on what to build next.",
    position: "bottom",
  },
  {
    targetKey: "requests-vote",
    page: "requests",
    title: "Prioritize with Votes",
    description:
      "Tap the upvote arrow on any request to signal what matters most. Requests are ranked by vote count, so the most-wanted features rise to the top. This gives you data-driven prioritization without meetings.",
    position: "bottom",
  },
  {
    targetKey: "requests-create",
    page: "requests",
    title: "Submit New Ideas",
    description:
      "Tap here to propose a new feature request. Add a clear title and description so your team can evaluate and vote. Great for capturing ideas before they get lost.",
    position: "top",
  },

  // ── Diary ─────────────────────────────────────────────────
  {
    targetKey: "diary-streak",
    page: "diary",
    title: "Your Build Diary",
    description:
      "The Build Diary is your founder's journal. It tracks your daily progress in a reverse-chronological timeline and rewards consistency with streaks. Log what you built, decisions you made, and any blockers. Even a quick 2-3 sentence entry keeps your streak alive and your progress documented.",
    position: "bottom",
  },
  {
    targetKey: "diary-add",
    page: "diary",
    title: "Add a Diary Entry",
    description:
      "Tap here to write today's entry. Over time, your diary becomes an invaluable record of your build process that helps you spot patterns, reflect on decisions, and share progress with your team.",
    position: "top",
  },

  // ── Knowledge ─────────────────────────────────────────────
  {
    targetKey: "knowledge-docs",
    page: "knowledge",
    title: "Your AI-Powered Knowledge Base",
    description:
      "This is where FoundersForge becomes truly powerful. Upload your project documents (specs, research, pitch decks, notes) and they're automatically processed, chunked, and embedded. This creates a private knowledge base that your AI assistant can search and reference in every conversation.",
    position: "bottom",
  },
  {
    targetKey: "knowledge-upload",
    page: "knowledge",
    title: "Upload Documents",
    description:
      "Tap here to upload PDFs, markdown files, text documents, and more. Each file is broken into searchable chunks using RAG (Retrieval-Augmented Generation). This means the AI doesn't just guess, it pulls real information from YOUR documents to give accurate answers.",
    position: "bottom",
  },
  {
    targetKey: "knowledge-chat-interface",
    page: "knowledge",
    title: "Chat with Your Knowledge Base",
    description:
      "This is your AI research assistant. It has read every document you've uploaded. Ask it questions like \"What did our user research say about onboarding?\" or \"Summarize the competitive analysis\" and it will answer using your actual documents as sources.",
    position: "bottom",
    navigateTo: "/(tabs)/knowledge/chat",
  },

  // ── Settings ──────────────────────────────────────────────
  {
    targetKey: "settings-workspace",
    page: "settings",
    title: "Workspace & Team",
    description:
      "Rename your workspace, share the invite code with teammates, or switch between workspaces. The workspace name appears in the header of every page. Make it your company or project name.",
    position: "bottom",
  },
  {
    targetKey: "settings-api-keys",
    page: "settings",
    title: "Connect Your AI Keys",
    description:
      "Add your own OpenAI or Anthropic API key to power all AI features: milestone chat, knowledge base chat, and AI import. Your keys are encrypted with AES-256-GCM and never leave your workspace. Without a key, AI features won't work.",
    position: "bottom",
  },
  {
    targetKey: "settings-brief",
    page: "settings",
    title: "Project Brief: Critical for AI Quality",
    description:
      "This is the single most important setting for AI quality. Write a brief description of your project: what it does, who it's for, what stage it's at. This brief is injected into EVERY AI conversation, so the AI always understands your context instead of giving generic answers.",
    position: "top",
  },
];
