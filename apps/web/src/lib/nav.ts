export type NavItem = {
  id: string;
  label: string;
  href: string;
  /** When false, shown as a disabled stub for a future module. */
  enabled: boolean;
};

/**
 * Top-level dashboard nav. Add items by appending — do not hardcode a fixed count.
 */
export const DASHBOARD_NAV: NavItem[] = [
  {
    id: "knowledge",
    label: "Knowledge Base",
    href: "/dashboard/knowledge",
    enabled: true,
  },
  {
    id: "search",
    label: "Search",
    href: "/dashboard/search",
    enabled: false,
  },
  {
    id: "applications",
    label: "Applications",
    href: "/dashboard/applications",
    enabled: false,
  },
  {
    id: "tracker",
    label: "Tracker",
    href: "/dashboard/tracker",
    enabled: false,
  },
  {
    id: "email",
    label: "Email",
    href: "/dashboard/email",
    enabled: false,
  },
  {
    id: "interview",
    label: "Interview Prep",
    href: "/dashboard/interview",
    enabled: false,
  },
  {
    id: "negotiation",
    label: "Negotiation",
    href: "/dashboard/negotiation",
    enabled: false,
  },
];
