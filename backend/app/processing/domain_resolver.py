"""Domain resolver — discovers company website domains via DNS verification + LLM fallback.

Two-stage approach:
  Stage 1 — Programmatic: Generate common domain variations from company name, verify via DNS.
  Stage 2 — LLM Fallback: Ask GPT to suggest the likely domain, then verify via DNS.
"""

import asyncio
import re
from typing import Optional

import dns.resolver
import structlog

from app.processing.llm_client import llm_client

logger = structlog.get_logger()

# Common TLDs to try, ordered by likelihood
_TLDS = [".com", ".co", ".net", ".org", ".io"]

# Suffixes to strip from company names before generating domain candidates
_COMPANY_SUFFIXES = re.compile(
    r"\b(inc\.?|incorporated|llc|ltd\.?|limited|corp\.?|corporation|co\.?|company|"
    r"companies|group|holdings|international|enterprises|l\.?p\.?|plc|sa|ag|nv|se|"
    r"the|&|\band\b)\b",
    re.IGNORECASE,
)

# Words too generic to use alone as a domain slug
_STOP_WORDS = {"the", "and", "of", "for", "in", "a", "an"}


def _slugify(name: str) -> list[str]:
    """Generate domain slug candidates from a company name.

    Returns a list of candidates like: ["acme", "acmecorp", "acme-corp"]
    """
    # Strip common suffixes
    clean = _COMPANY_SUFFIXES.sub("", name.lower())
    # Remove non-alphanumeric except spaces/hyphens
    clean = re.sub(r"[^\w\s-]", "", clean)
    clean = re.sub(r"\s+", " ", clean).strip()

    if not clean:
        return []

    words = [w for w in clean.split() if w not in _STOP_WORDS]
    if not words:
        words = clean.split()
    if not words:
        return []

    slugs = set()

    # Full joined: "wellsfargo"
    joined = "".join(words)
    if len(joined) >= 2:
        slugs.add(joined)

    # Hyphenated: "wells-fargo"
    if len(words) > 1:
        slugs.add("-".join(words))

    # First word only (if meaningful): "wells"
    if len(words[0]) >= 3:
        slugs.add(words[0])

    # First + "corp" / "inc" / "co": "wellscorp"
    if len(words) >= 1:
        for suffix in ["corp", "inc", "co"]:
            slugs.add(joined + suffix)

    # Initials for multi-word names: "wf"
    if len(words) >= 2:
        initials = "".join(w[0] for w in words)
        if len(initials) >= 2:
            slugs.add(initials)

    return list(slugs)


async def _has_dns(domain: str) -> bool:
    """Check if a domain has DNS records (A, AAAA, or MX)."""
    loop = asyncio.get_event_loop()
    resolver = dns.resolver.Resolver()
    resolver.timeout = 3
    resolver.lifetime = 3

    for rtype in ("A", "MX"):
        try:
            await loop.run_in_executor(None, resolver.resolve, domain, rtype)
            return True
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers):
            continue
        except dns.resolver.LifetimeTimeout:
            continue
        except Exception:
            continue

    return False


async def _check_candidates(candidates: list[str]) -> Optional[str]:
    """Check a batch of domain candidates concurrently. Returns first valid one."""
    if not candidates:
        return None

    # Run DNS checks concurrently (max 10 at a time)
    semaphore = asyncio.Semaphore(10)

    async def check_one(domain: str) -> Optional[str]:
        async with semaphore:
            if await _has_dns(domain):
                return domain
            return None

    tasks = [check_one(c) for c in candidates]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, str):
            return result

    return None


async def resolve_domain_programmatic(company_name: str) -> Optional[str]:
    """Stage 1: Generate domain candidates from company name and verify via DNS.

    Returns the first valid domain, or None if none found.
    """
    slugs = _slugify(company_name)
    if not slugs:
        return None

    # Build candidate list: each slug × each TLD
    candidates = []
    for slug in slugs:
        for tld in _TLDS:
            candidates.append(slug + tld)

    # Check most likely candidates first (batched)
    result = await _check_candidates(candidates)
    if result:
        logger.info(
            "domain_resolver.programmatic_hit",
            company=company_name,
            domain=result,
        )
    return result


async def resolve_domain_llm(company_name: str, headquarters_state: str | None = None) -> Optional[str]:
    """Stage 2: Ask LLM to suggest the company's domain, then verify via DNS."""
    location_hint = f" (headquartered in {headquarters_state})" if headquarters_state else ""

    prompt = (
        f"What is the official website domain for the company \"{company_name}\"{location_hint}?\n\n"
        "Return ONLY the bare domain (e.g. \"apple.com\") with no protocol, path, or explanation.\n"
        "If you are not sure or the company doesn't have a website, return \"unknown\".\n\n"
        "Domain:"
    )

    try:
        text = await llm_client.complete(prompt, model="haiku", max_tokens=64)
        domain = text.strip().strip('"').strip("'").lower()

        # Clean up common LLM artifacts
        domain = domain.removeprefix("http://").removeprefix("https://").removeprefix("www.")
        domain = domain.split("/")[0].strip()

        if not domain or domain == "unknown" or "." not in domain or len(domain) > 255:
            return None

        # Verify with DNS
        if await _has_dns(domain):
            logger.info(
                "domain_resolver.llm_hit",
                company=company_name,
                domain=domain,
            )
            return domain

        # Try www. variant
        www_domain = f"www.{domain}"
        if await _has_dns(www_domain):
            logger.info(
                "domain_resolver.llm_hit_www",
                company=company_name,
                domain=domain,
            )
            return domain

        logger.info("domain_resolver.llm_no_dns", company=company_name, suggested=domain)
        return None

    except Exception as e:
        logger.warning("domain_resolver.llm_failed", company=company_name, error=str(e))
        return None


async def resolve_domain(company_name: str, headquarters_state: str | None = None) -> Optional[str]:
    """Resolve a company's website domain using programmatic guessing + LLM fallback.

    Returns a verified domain string, or None if not found.
    """
    if not company_name or len(company_name.strip()) < 2:
        return None

    # Stage 1: Programmatic DNS guessing
    domain = await resolve_domain_programmatic(company_name)
    if domain:
        return domain

    # Stage 2: LLM suggestion + DNS verification
    domain = await resolve_domain_llm(company_name, headquarters_state)
    if domain:
        return domain

    logger.info("domain_resolver.not_found", company=company_name)
    return None
