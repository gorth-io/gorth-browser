import {
  Rocket,
  Palette,
  PanelsTopLeft,
  ShieldCheck,
  LockKeyhole,
  Wallet,
  Sparkles,
  RefreshCw,
  Search,
  Puzzle,
  ListChecks,
  Languages,
  Download,
  Accessibility,
  Settings,
  RotateCcw,
  Info,
} from "lucide-react";

export const settingsPagesFirst = [
  {
    id: "settings/get-started",
    title: "Get started",
    icon: Rocket,
    description: "Choose how you start browsing.",
  },
  {
    id: "settings/appearance",
    title: "Appearance",
    icon: Palette,
    description: "Customize the browser interface.",
  },
  {
    id: "settings/content",
    title: "Content",
    icon: PanelsTopLeft,
    description: "Manage website content preferences.",
  },
  {
    id: "settings/shields",
    title: "Shields",
    icon: ShieldCheck,
    description: "Configure protection from trackers and unwanted content.",
  },
  {
    id: "settings/privacy",
    title: "Privacy and security",
    icon: LockKeyhole,
    description: "Manage privacy and browsing data.",
  },
  {
    id: "settings/web3",
    title: "Web3",
    icon: Wallet,
    description: "Manage decentralized web integrations.",
  },
  {
    id: "settings/leo",
    title: "Leo",
    icon: Sparkles,
    description: "Configure your browsing assistant.",
  },
  {
    id: "settings/sync",
    title: "Sync",
    icon: RefreshCw,
    description: "Keep browsing data synchronized between devices.",
  },
  {
    id: "settings/search",
    title: "Search engine",
    icon: Search,
    description: "Choose how searches are handled.",
  },
  {
    id: "settings/extensions",
    title: "Extensions",
    icon: Puzzle,
    description: "Configure extension preferences.",
  },
] as const;

export const settingsPagesSecond = [
  {
    id: "settings/autofill",
    title: "Autofill and passwords",
    icon: ListChecks,
    description: "Manage saved form information and passwords.",
  },
  {
    id: "settings/languages",
    title: "Languages",
    icon: Languages,
    description: "Choose language and translation preferences.",
  },
  {
    id: "settings/downloads",
    title: "Downloads",
    icon: Download,
    description: "Configure file download preferences.",
  },
  {
    id: "settings/accessibility",
    title: "Accessibility",
    icon: Accessibility,
    description: "Customize accessibility preferences.",
  },
  {
    id: "settings/system",
    title: "System",
    icon: Settings,
    description: "Manage browser system preferences.",
  },
  {
    id: "settings/reset",
    title: "Reset settings",
    icon: RotateCcw,
    description: "Restore browser preferences.",
  },
  {
    id: "settings/help",
    title: "About Gorth",
    icon: Info,
    description: "Learn about Gorth Browser and internal pages.",
  },
] as const;

export const settingsPages = [
  ...settingsPagesFirst,
  ...settingsPagesSecond,
] as const;