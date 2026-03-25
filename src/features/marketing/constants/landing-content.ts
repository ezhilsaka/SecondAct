import type {
  FooterColumn,
  GapCard,
  NavItem,
  StatItem,
  StepItem
} from "@/features/marketing/types/landing";

export const navItems: NavItem[] = [
  { label: "Reports", href: "#" },
  { label: "How It Works", href: "#" },
  { label: "Pricing", href: "#" },
  { label: "Contact", href: "#" }
];

export const gapCards: GapCard[] = [
  {
    id: "THE GAP",
    title: "The Gap",
    body: "Buying is easy. Portfolio understanding is hard. Most DIY investors stop at acquisition. We help you understand the true performance, risk, and health of what you own."
  },
  {
    id: "THE SOLUTION",
    title: "The Solution",
    body: "A second act for DIY investors. Move beyond simple stock picking. Enter the era of portfolio intelligence."
  }
];

export const flowSteps: StepItem[] = [
  { label: "Create portfolio or import Excel" },
  { label: "Run advisor-style grading" },
  { label: "Download PDF + action checklist" }
];

export const pricingStats: StatItem[] = [
  { value: "$4.99", label: "Flat fee / report" },
  { value: "Flat", label: "One price every report" },
  { value: "No Sub", label: "No monthly commitment" },
  { value: "On-Demand", label: "Run reports only when needed" }
];

export const footerColumns: FooterColumn[] = [
  { title: "Report", links: ["How It Works", "Methodology", "Sample PDF"] },
  { title: "Support", links: ["Pricing", "FAQ", "Contact"] }
];
