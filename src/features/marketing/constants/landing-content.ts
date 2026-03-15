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
  { value: "$11.11", label: "First report" },
  { value: "$8.33", label: "Second report (25% off)" },
  { value: "$5.56", label: "Third report (50% off)" },
  { value: "$2.78", label: "Fourth report (75% off)" }
];

export const footerColumns: FooterColumn[] = [
  { title: "Report", links: ["How It Works", "Methodology", "Sample PDF"] },
  { title: "Support", links: ["Pricing", "FAQ", "Contact"] }
];
