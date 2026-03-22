import {
  flowSteps,
  footerColumns,
  gapCards,
  navItems,
  pricingStats
} from "@/features/marketing/constants/landing-content";
import styles from "./SecondActLanding.module.css";

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? styles.brandMarkCompact : styles.brandMark} aria-hidden="true">
      <span className={styles.brandDot} />
      <span className={styles.brandPillarA} />
      <span className={styles.brandPillarB} />
      <span className={styles.brandBase} />
    </span>
  );
}

function HeroReportPreview() {
  return (
    <div className={styles.heroPreviewCard}>
      <p className={styles.previewTitle}>Quarterly Portfolio Grading Report</p>
      <div className={styles.previewHeaderLine} />

      <div className={styles.previewMetricRow}>
        <div className={styles.previewMetricCard}>
          <p className={styles.previewMetricLabel}>Score 78/100</p>
          <div className={styles.previewMetricBarStrong} />
        </div>
        <div className={styles.previewMetricCardMuted}>
          <p className={styles.previewMetricLabel}>Risk: Moderate</p>
          <div className={styles.previewMetricBarSoft} />
        </div>
      </div>

      <div className={styles.previewChartCard}>
        <p className={styles.previewMetricLabel}>Return Contribution</p>
        <div className={styles.previewRowDark} />
        <div className={styles.previewRowMid} />
        <div className={styles.previewRowLight} />
      </div>
    </div>
  );
}

export default function SecondActLanding() {
  return (
    <main className={styles.landingRoot}>
      <header className={styles.header}>
        <div className={styles.brandWrap}>
          <BrandMark />
          <p className={styles.brandWord}>Second Act</p>
        </div>

        <nav className={styles.nav} aria-label="Primary">
          {navItems.map((item) => (
            <a key={item.label} className={styles.navLink} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <button type="button" className={styles.headerCta}>
          Get One-Time Report
        </button>
      </header>

      <section className={styles.heroSection}>
        <div className={styles.heroLeft}>
          <p className={styles.kicker}>UNDERSTAND YOUR PORTFOLIO</p>
          <h1 className={styles.heroTitle}>Pay once. Get a professional-grade portfolio report.</h1>
          <p className={styles.heroSub}>
            AI-assisted portfolio diagnostics explained in plain language.
          </p>

          <div className={styles.ctaRow}>
            <button type="button" className={styles.primaryCta}>
              Generate One-Time Report
            </button>
            <button type="button" className={styles.secondaryCta}>
              View Sample PDF
            </button>
          </div>

          <p className={styles.trustLine}>
            Transparent methodology. Data-driven insights. Not investment advice.
          </p>
        </div>

        <aside className={styles.heroVisual} aria-label="Quarterly report preview">
          <p className={styles.heroVisualTitle}>Quarterly Report Preview</p>
          <HeroReportPreview />
        </aside>
      </section>

      <section className={styles.gapSection}>
        <p className={styles.kicker}>THE GAP + THE SOLUTION</p>
        <h2 className={styles.sectionTitle}>Buying is easy. Portfolio understanding is hard.</h2>
        <p className={styles.sectionSub}>
          Most DIY investors stop at acquisition. Second Act helps you understand the true
          performance, risk, and health of what you own.
        </p>

        <div className={styles.gapCardGrid}>
          {gapCards.map((card) => (
            <article key={card.id} className={styles.gapCard}>
              <p className={styles.gapCardId}>{card.id}</p>
              <h3 className={styles.gapCardTitle}>{card.title}</h3>
              <p className={styles.gapCardBody}>{card.body}</p>
            </article>
          ))}
        </div>

        <div className={styles.stepRow}>
          {flowSteps.map((step) => (
            <p key={step.label} className={styles.stepChip}>
              {step.label}
            </p>
          ))}
        </div>
      </section>

      <section className={styles.pricingSection}>
        <p className={styles.kicker}>THE PRICING RULES</p>
        <h2 className={styles.sectionTitleAlt}>
          Pay once, then unlock deeper discounts each report.
        </h2>

        <div className={styles.statGrid}>
          {pricingStats.map((stat) => (
            <article key={stat.value} className={styles.statCard}>
              <p className={styles.statValue}>{stat.value}</p>
              <p className={styles.statLabel}>{stat.label}</p>
            </article>
          ))}
        </div>

        <blockquote className={styles.quoteCard}>
          <p>
            &quot;Reports 1-4 are paid with tiered discounts. Reports 5-9 are free, with a maximum of 9
            reports per calendar year.&quot;
          </p>
          <footer>Counter resets every January 1 (Jan-Dec cycle)</footer>
        </blockquote>

        <div className={styles.badgeRow}>
          <span className={styles.badge}>9 Reports / Year Cap</span>
          <span className={styles.badge}>Reports 5-9 Free</span>
        </div>
      </section>

      <section className={styles.finalSection}>
        <h2 className={styles.finalTitle}>
          Your first act was buying. Your second act is understanding.
        </h2>
        <p className={styles.finalSub}>
          Join thousands of smart DIY investors who have stopped guessing and started knowing.
        </p>
        <button type="button" className={styles.primaryCta}>
          Generate My Report
        </button>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <div className={styles.brandWrapCompact}>
              <BrandMark compact />
              <p className={styles.footerWord}>Second Act</p>
            </div>
            <p className={styles.footerTag}>Understand your portfolio</p>
          </div>

          <div className={styles.footerCols}>
            {footerColumns.map((col) => (
              <div key={col.title} className={styles.footerCol}>
                <p className={styles.footerColTitle}>{col.title}</p>
                {col.links.map((link) => (
                  <a key={link} href="#" className={styles.footerLink}>
                    {link}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p>© 2026 Second Act. All rights reserved.</p>
          <p>Privacy • Terms • Disclosures</p>
        </div>
      </footer>
    </main>
  );
}
