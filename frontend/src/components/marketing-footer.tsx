import Link from "next/link";
import { NewsletterSignup } from "@/components/newsletter-signup";

export function MarketingFooter() {
  return (
    <footer
      className="border-t px-4 sm:px-6 py-8 sm:py-10"
      style={{ borderColor: "var(--border-default)" }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Newsletter */}
        <div className="mb-8 max-w-md mx-auto">
          <NewsletterSignup
            variant="compact"
            headline="Weekly distress signals — free in your inbox"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="DispoSight" className="h-5 opacity-60" />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              DispoSight
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link
              href="/about"
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              About
            </Link>
            <Link
              href="/pricing"
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              Pricing
            </Link>
            <Link
              href="/faq"
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              FAQ
            </Link>
            <Link
              href="/blog"
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              Blog
            </Link>
            <Link
              href="/contact"
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              Contact
            </Link>
            <Link
              href="/login"
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              Sign In
            </Link>
            <a
              href="mailto:support@disposight.com"
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              support@disposight.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
