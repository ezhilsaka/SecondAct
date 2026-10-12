import {
  flowSteps,
  footerColumns,
  gapCards,
  navItems,
  pricingStats
} from "@/features/marketing/constants/landing-content";
import Image from "next/image";
import styles from "./SecondActLanding.module.css";

const SAMPLE_REPORT_PREVIEW_ID = "sample-report-preview";
const SAMPLE_REPORT_PREVIEW_HREF = `#${SAMPLE_REPORT_PREVIEW_ID}`;

export type SecondActLandingProps = {
  reportCtaHref: string;
};

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
      <Image
        className={styles.previewImage}
        src="/images/sample-report-preview.png"
        alt="Sample Second Act portfolio report showing an executive summary and portfolio allocation"
        fill
        sizes="(max-width: 900px) 100vw, 50vw"
      />
    </div>
  );
}

export default function SecondActLanding({ reportCtaHref }: SecondActLandingProps) {
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

        <a className={styles.headerCta} href={reportCtaHref}>
          Get One-Time Report
        </a>
      </header>

      <section className={styles.heroSection}>
        <div className={styles.heroLeft}>
          <p className={styles.kicker}>UNDERSTAND YOUR PORTFOLIO</p>
          <h1 className={styles.heroTitle}>Pay once. Get a professional-grade portfolio report.</h1>
          <p className={styles.heroSub}>
            AI-assisted portfolio diagnostics explained in plain language.
          </p>

          <div className={styles.ctaRow}>
            <a className={styles.primaryCta} href={reportCtaHref}>
              Generate One-Time Report
            </a>
            <a className={styles.secondaryCta} href={SAMPLE_REPORT_PREVIEW_HREF}>
              View Sample PDF
            </a>
          </div>

          <p className={styles.trustLine}>
            Transparent methodology. Data-driven insights. Not investment advice.
          </p>
        </div>

        <aside
          id={SAMPLE_REPORT_PREVIEW_ID}
          className={styles.heroVisual}
          aria-label="Quarterly report preview"
        >
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
        <p className={styles.kicker}>FLAT FEE PRICING</p>
        <h2 className={styles.sectionTitleAlt}>Get portfolio clarity. Pay only when it matters.</h2>

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
            &quot;Most tools charge you to track every day. Second Act is built for long-term DIY
            investors who want high-signal reviews on their schedule.&quot;
          </p>
          <footer>
            Get a professional-grade portfolio report for a flat $4.99 per checkup. No monthly fees,
            no lock-in, no noise.
          </footer>
        </blockquote>

        <div className={styles.badgeRow}>
          <span className={styles.badge}>Flat $4.99</span>
          <span className={styles.badge}>No Monthly Commitment</span>
        </div>
      </section>

      <section className={styles.finalSection}>
        <h2 className={styles.finalTitle}>
          Your first act was buying. Your second act is understanding.
        </h2>
        <p className={styles.finalSub}>
          Join thousands of smart DIY investors who have stopped guessing and started knowing.
        </p>
        <a className={styles.primaryCta} href={reportCtaHref}>
          Generate My Report
        </a>
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
