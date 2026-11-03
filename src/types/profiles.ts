import type { Currency } from "./billing";
import type { AccentPreference, ThemePreference } from "@/lib/theme";

export const MAX_PROFILES = 5;

export type ProfileRole =
  | "software-engineering"
  | "ai-development"
  | "consulting"
  | "design"
  | "general";

export type ProfileAvatar =
  | "code"
  | "sparkles"
  | "compass"
  | "layers"
  | "briefcase"
  | "cpu"
  | "globe"
  | "shield";

export interface UserProfile {
  id: string;
  name: string;
  role: ProfileRole;
  subtitle: string;
  avatar: ProfileAvatar;
  accent: AccentPreference;
  themePreference: ThemePreference;
  defaultCurrency: Currency;
  invoicePrefix: string;
  hasPassword: boolean;
  passwordHint: string | null;
  isActive: boolean;
  isOnboarded: boolean;
  position: number;
  lastActiveAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProfileInput {
  name: string;
  role: ProfileRole;
  subtitle?: string;
  avatar?: ProfileAvatar;
  accent?: AccentPreference;
  themePreference?: ThemePreference;
  defaultCurrency?: Currency;
  invoicePrefix?: string;
  password?: string;
  passwordHint?: string;
  seedRoleCatalog?: boolean;
}

export interface UpdateProfileInput {
  name?: string;
  role?: ProfileRole;
  subtitle?: string;
  avatar?: ProfileAvatar;
  accent?: AccentPreference;
  themePreference?: ThemePreference;
  defaultCurrency?: Currency;
  invoicePrefix?: string;
  password?: string | null;
  currentPassword?: string;
  passwordHint?: string | null;
  isOnboarded?: boolean;
}

export interface OnboardingProfileSlot {
  name: string;
  role: ProfileRole;
  subtitle: string;
  avatar: ProfileAvatar;
  accent: AccentPreference;
  defaultCurrency: Currency;
  invoicePrefix: string;
  password?: string;
  passwordHint?: string;
  seedRoleCatalog: boolean;
}

export interface CompleteOnboardingInput {
  studioName: string;
  email?: string;
  defaultCurrency: Currency;
  profiles: OnboardingProfileSlot[];
}

export interface ProfileListResponse {
  profiles: UserProfile[];
  activeProfileId: string;
  maxProfiles: number;
  needsOnboarding: boolean;
}

export interface RoleStarterCatalogTemplate {
  title: string;
  category: "Development" | "Design" | "Consulting" | "Licensing";
  sku: string;
  description: string;
  priceCents: number;
  unit: string;
  iconType: "code" | "design" | "cloud" | "consulting";
}

export interface ProfileRolePreset {
  role: ProfileRole;
  label: string;
  shortLabel: string;
  defaultName: string;
  subtitle: string;
  description: string;
  avatar: ProfileAvatar;
  accent: AccentPreference;
  invoicePrefix: string;
  starterCatalog: RoleStarterCatalogTemplate[];
}

export const PROFILE_ROLE_PRESETS: Record<ProfileRole, ProfileRolePreset> = {
  "software-engineering": {
    role: "software-engineering",
    label: "Software Engineering",
    shortLabel: "Engineering",
    defaultName: "Software Engineering",
    subtitle: "Full-Stack & Systems",
    description:
      "Web applications, custom software builds, API architecture, and production deployments.",
    avatar: "code",
    accent: "blue",
    invoicePrefix: "SE-",
    starterCatalog: [
      {
        title: "Business Website Development",
        category: "Development",
        sku: "SE-WEB-001",
        description:
          "Responsive custom business website with CMS setup, performance optimization, and staging deployment.",
        priceCents: 180000,
        unit: "/ Fixed",
        iconType: "code",
      },
      {
        title: "Custom Full-Stack Web Application",
        category: "Development",
        sku: "SE-APP-002",
        description:
          "End-to-end web application engineering with database schema design, authentication, and API endpoints.",
        priceCents: 350000,
        unit: "/ Project",
        iconType: "code",
      },
      {
        title: "Backend Architecture & API Integration",
        category: "Development",
        sku: "SE-API-003",
        description:
          "Service integration, database migration, and high-reliability REST/GraphQL API engineering.",
        priceCents: 120000,
        unit: "/ Sprint",
        iconType: "cloud",
      },
    ],
  },
  "ai-development": {
    role: "ai-development",
    label: "AI Development",
    shortLabel: "AI Systems",
    defaultName: "AI Development",
    subtitle: "LLMs, Agents & ML Pipelines",
    description:
      "LLM pipelines, customer-support automation agents, RAG knowledge systems, and model integrations.",
    avatar: "sparkles",
    accent: "purple",
    invoicePrefix: "AI-",
    starterCatalog: [
      {
        title: "Customer-Support AI Agent & RAG Pipeline",
        category: "Development",
        sku: "AI-AGT-001",
        description:
          "Custom conversational AI agent connected to internal documentation with automated ticket triage.",
        priceCents: 240000,
        unit: "/ Project",
        iconType: "cloud",
      },
      {
        title: "LLM Workflow & Process Automation",
        category: "Development",
        sku: "AI-AUT-002",
        description:
          "Automated document extraction, prompt engineering pipeline, and webhook orchestration.",
        priceCents: 160000,
        unit: "/ Fixed",
        iconType: "code",
      },
      {
        title: "Model Evaluation & Fine-Tuning Setup",
        category: "Development",
        sku: "AI-EVL-003",
        description:
          "Dataset curation, benchmark evaluation harness, and production inference deployment.",
        priceCents: 195000,
        unit: "/ Milestone",
        iconType: "cloud",
      },
    ],
  },
  consulting: {
    role: "consulting",
    label: "Technical Consulting",
    shortLabel: "Consulting",
    defaultName: "Technical Consulting",
    subtitle: "Architecture & Strategy Advisory",
    description:
      "AI consulting sessions, customer-support automation planning, architecture audits, and advisory retainers.",
    avatar: "compass",
    accent: "emerald",
    invoicePrefix: "CON-",
    starterCatalog: [
      {
        title: "AI Consulting Session & Automation Roadmap",
        category: "Consulting",
        sku: "CON-AIR-001",
        description:
          "Deep-dive discovery workshop and written recommendations for customer-support and workflow automation.",
        priceCents: 45000,
        unit: "/ Session",
        iconType: "consulting",
      },
      {
        title: "System Architecture & Security Audit",
        category: "Consulting",
        sku: "CON-AUD-002",
        description:
          "Codebase, infrastructure, and scalability review with prioritized engineering action plan.",
        priceCents: 125000,
        unit: "/ Fixed",
        iconType: "consulting",
      },
      {
        title: "Fractional CTO / Technical Advisory Retainer",
        category: "Consulting",
        sku: "CON-RET-003",
        description:
          "Ongoing weekly technical strategy, vendor evaluation, and engineering team guidance.",
        priceCents: 200000,
        unit: "/ Monthly",
        iconType: "consulting",
      },
    ],
  },
  design: {
    role: "design",
    label: "Product & UI Design",
    shortLabel: "Design",
    defaultName: "Product Design",
    subtitle: "UI/UX & Design Systems",
    description:
      "Interface design, interactive prototypes, design systems, and brand visual identity deliverables.",
    avatar: "layers",
    accent: "rose",
    invoicePrefix: "DSN-",
    starterCatalog: [
      {
        title: "Web App UI/UX Design & Figma Prototype",
        category: "Design",
        sku: "DSN-UIX-001",
        description:
          "Complete multi-screen interface design, component library, and interactive Figma handoff.",
        priceCents: 140000,
        unit: "/ Project",
        iconType: "design",
      },
      {
        title: "Brand Identity & Visual System",
        category: "Design",
        sku: "DSN-BRD-002",
        description:
          "Logo mark, typography scale, color tokens, and digital brand guidelines.",
        priceCents: 95000,
        unit: "/ Fixed",
        iconType: "design",
      },
    ],
  },
  general: {
    role: "general",
    label: "General Practice",
    shortLabel: "General",
    defaultName: "General Workspace",
    subtitle: "Operations & Retainers",
    description:
      "Multi-disciplinary freelance workspace for mixed client projects, retainers, and general billing.",
    avatar: "briefcase",
    accent: "amber",
    invoicePrefix: "INV-",
    starterCatalog: [
      {
        title: "Custom Freelance Deliverable",
        category: "Development",
        sku: "GEN-DEL-001",
        description:
          "Scoped project deliverable, implementation milestone, and client handoff.",
        priceCents: 85000,
        unit: "/ Fixed",
        iconType: "code",
      },
    ],
  },
};

export const PROFILE_ROLE_LIST: ProfileRolePreset[] = [
  PROFILE_ROLE_PRESETS["software-engineering"],
  PROFILE_ROLE_PRESETS["ai-development"],
  PROFILE_ROLE_PRESETS["consulting"],
  PROFILE_ROLE_PRESETS["design"],
  PROFILE_ROLE_PRESETS["general"],
];
