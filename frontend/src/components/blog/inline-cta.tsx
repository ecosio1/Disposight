import Link from "next/link";

interface InlineCTAProps {
  headline: string;
  description: string;
  buttonText?: string;
  buttonUrl?: string;
}

export function InlineCTA({
  headline,
  description,
  buttonText = "Try DispoSight Free",
  buttonUrl = "/register",
}: InlineCTAProps) {
  return (
    <aside
      className="rounded-md px-5 py-4 my-8 border-l-4 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{
        borderColor: "var(--accent)",
        backgroundColor: "rgba(16, 185, 129, 0.04)",
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>
          {headline}
        </p>
        <p className="text-sm m-0" style={{ color: "var(--text-secondary)" }}>
          {description}
        </p>
      </div>
      <Link
        href={buttonUrl}
        className="inline-block px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all hover:brightness-110 flex-shrink-0"
        style={{ backgroundColor: "var(--accent)", color: "#fff" }}
      >
        {buttonText}
      </Link>
    </aside>
  );
}
