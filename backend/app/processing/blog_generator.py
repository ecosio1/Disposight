"""Alert-driven keyword jacking blog generator.

Auto-publishes SEO blog posts when distress signals are detected,
targeting zero-competition keywords like "{Company} closing" or
"{Company} layoffs" before anyone else writes about them.

Flow:
  Signal processed (pipeline.py Step 8b) -> queue_blog_post()
  Cron job (every 6 hours) -> process_blog_queue()
    -> OpenAI generates blog JSON
    -> Unsplash fetches hero image
    -> GitHub API commits JSON to repo
    -> Vercel auto-deploys (~2 min)
    -> WebSub + IndexNow pings for fast indexing
"""

import base64
import json
import math
import re
import uuid
from datetime import date, datetime, timezone

import httpx
import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.blog_post import BlogPost
from app.models.company import Company
from app.models.signal import Signal

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Category mapping from signal_type
# ---------------------------------------------------------------------------
SIGNAL_TYPE_TO_CATEGORY = {
    "layoff": "warn-act",
    "workforce_reduction": "warn-act",
    "bankruptcy_ch7": "bankruptcy-guide",
    "bankruptcy_ch11": "bankruptcy-guide",
    "facility_shutdown": "liquidation-strategy",
    "plant_closing": "liquidation-strategy",
    "office_closure": "liquidation-strategy",
    "restructuring": "industry-analysis",
    "m_and_a": "industry-analysis",
    "liquidation": "asset-recovery",
}

# Primary keyword patterns by signal type
KEYWORD_PATTERNS = {
    "layoff": "{company} layoffs",
    "workforce_reduction": "{company} layoffs",
    "bankruptcy_ch7": "{company} bankruptcy",
    "bankruptcy_ch11": "{company} bankruptcy",
    "facility_shutdown": "{company} closing",
    "plant_closing": "{company} closing",
    "office_closure": "{company} closing",
    "restructuring": "{company} restructuring",
    "m_and_a": "{company} restructuring",
    "liquidation": "{company} liquidation",
}

# Default CTA
DEFAULT_CTA = {
    "headline": "Stay Ahead of Every Distressed Asset Opportunity",
    "description": (
        "DispoSight monitors WARN Act filings, bankruptcy courts, SEC filings, "
        "and global news — delivering actionable distress signals before your "
        "competitors see them."
    ),
    "buttonText": "Start Free Trial",
    "buttonUrl": "/register",
}

DEFAULT_AUTHOR = {
    "name": "DispoSight Research",
    "role": "Market Intelligence Team",
    "bio": (
        "The DispoSight Research team monitors corporate distress signals across "
        "WARN Act filings, bankruptcy courts, SEC filings, and global news to "
        "surface asset disposition opportunities for deal-driven organizations."
    ),
}

DEFAULT_HERO_IMAGE = {
    "url": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80",
    "alt": "Warehouse with stacked inventory",
    "credit": "Unsplash",
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def queue_blog_post(
    db: AsyncSession, signal: Signal, company: Company
) -> bool:
    """Queue a blog post for a newly detected signal (Step 8b).

    Returns True if a post was queued, False if skipped.
    """
    # Check if company already has a blog post (unique constraint)
    existing = await db.execute(
        select(BlogPost.id).where(BlogPost.company_id == company.id).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        logger.debug(
            "blog.already_exists",
            company_id=str(company.id),
            company=company.name,
        )
        return False

    # Check daily published count
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    daily_count_result = await db.execute(
        select(func.count(BlogPost.id)).where(
            BlogPost.status.in_(["queued", "published"]),
            BlogPost.created_at >= today_start,
        )
    )
    daily_count = daily_count_result.scalar() or 0
    if daily_count >= settings.blog_max_daily:
        logger.info(
            "blog.daily_cap_reached",
            daily_count=daily_count,
            max_daily=settings.blog_max_daily,
        )
        return False

    post = BlogPost(
        company_id=company.id,
        signal_id=signal.id,
        status="queued",
    )
    db.add(post)
    await db.flush()

    logger.info(
        "blog.post_queued",
        blog_post_id=str(post.id),
        company=company.name,
        signal_type=signal.signal_type,
    )
    return True


async def process_blog_queue(db: AsyncSession) -> dict:
    """Process queued blog posts (called by cron job).

    Returns dict with counts: {"published": int, "failed": int, "skipped": int}.
    """
    if not settings.github_token:
        logger.warning("blog.no_github_token", msg="Skipping blog queue — GITHUB_TOKEN not set")
        return {"published": 0, "failed": 0, "skipped": 0}

    # Check daily cap
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    published_today_result = await db.execute(
        select(func.count(BlogPost.id)).where(
            BlogPost.status == "published",
            BlogPost.published_at >= today_start,
        )
    )
    published_today = published_today_result.scalar() or 0
    remaining = max(0, settings.blog_max_daily - published_today)

    if remaining == 0:
        logger.info("blog.daily_cap_reached_in_queue", published_today=published_today)
        return {"published": 0, "failed": 0, "skipped": 0}

    # Fetch queued posts
    result = await db.execute(
        select(BlogPost)
        .where(BlogPost.status == "queued")
        .order_by(BlogPost.created_at)
        .limit(remaining)
    )
    queued_posts = result.scalars().all()

    if not queued_posts:
        return {"published": 0, "failed": 0, "skipped": 0}

    published = 0
    failed = 0

    async with httpx.AsyncClient(timeout=60.0) as http:
        for blog_post in queued_posts:
            try:
                # Load signal + company
                signal = await db.get(Signal, blog_post.signal_id)
                company = await db.get(Company, blog_post.company_id)
                if not signal or not company:
                    blog_post.status = "failed"
                    blog_post.error_message = "Signal or company not found"
                    failed += 1
                    continue

                # Generate blog content via OpenAI
                raw_content = await _generate_blog_content(signal, company)

                # Fetch hero image
                hero_image = await _fetch_hero_image(http, company, signal)

                # Post-process into full BlogPost JSON
                post_json = _post_process(raw_content, hero_image)
                slug = post_json["slug"]

                # Publish to GitHub
                await _publish_to_github(http, post_json)

                # Notify search engines (fire-and-forget)
                await _notify_search_engines(http, slug)

                # Update tracking row
                blog_post.slug = slug
                blog_post.title = post_json["title"]
                blog_post.status = "published"
                blog_post.published_at = datetime.now(timezone.utc)
                published += 1

                logger.info(
                    "blog.post_published",
                    slug=slug,
                    company=company.name,
                    signal_type=signal.signal_type,
                )

            except Exception as e:
                blog_post.status = "failed"
                blog_post.error_message = str(e)[:500]
                failed += 1
                logger.error(
                    "blog.publish_error",
                    blog_post_id=str(blog_post.id),
                    error=str(e),
                )

    await db.flush()
    logger.info(
        "blog.queue_processed",
        published=published,
        failed=failed,
        total_queued=len(queued_posts),
    )
    return {"published": published, "failed": failed, "skipped": 0}


# ---------------------------------------------------------------------------
# OpenAI content generation
# ---------------------------------------------------------------------------

BLOG_SYSTEM_PROMPT = """You are a senior business journalist writing for DispoSight, a corporate distress intelligence platform. Write news-style articles about corporate distress events (closures, layoffs, bankruptcies, liquidations) aimed at asset buyers, liquidation firms, and distressed-debt investors.

Your article MUST follow this exact structure with 800-1200 words:

1. **Opening hook** (no heading) — 2-3 sentences summarizing what happened and why asset buyers should care
2. **## What Happened** — Factual summary of the event with dates, numbers, and context
3. **## Assets Becoming Available** — What equipment, inventory, or real estate could hit the market. Be specific to the industry.
4. **## Who's Handling the Liquidation** — Likely auction houses, trustees, or disposition firms (if unknown, describe the typical process)
5. **## Timeline & Key Dates** — WARN Act deadlines, court dates, lease expirations, or auction windows
6. **## How to Position** — Actionable advice for asset buyers: what to do right now
7. **## What DispoSight Shows** — Brief mention of how DispoSight detected this signal and what related signals exist
8. **## Frequently Asked Questions** — 3-5 FAQs in this exact format:
   - **Q: Question here?**
     A: Answer here.
9. **## Disclaimer** — Standard disclaimer about informational purposes only

Output ONLY valid JSON with these fields:
{
  "title": "string (max 70 chars, include company name and event type)",
  "description": "string (max 165 chars, SEO meta description)",
  "primaryKeyword": "string (e.g. 'Acme Corp closing')",
  "category": "string (one of: warn-act, bankruptcy-guide, liquidation-strategy, industry-analysis, asset-recovery)",
  "tags": ["string array, 4-6 relevant tags"],
  "body": "string (full markdown article body, 800-1200 words)",
  "faqs": [{"question": "string", "answer": "string"}],
  "sources": [{"title": "string", "url": "string"}]
}"""


async def _generate_blog_content(signal: Signal, company: Company) -> dict:
    """Generate blog post content via OpenAI."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    category = SIGNAL_TYPE_TO_CATEGORY.get(signal.signal_type, "industry-analysis")
    keyword_pattern = KEYWORD_PATTERNS.get(signal.signal_type, "{company} distress")
    primary_keyword = keyword_pattern.format(company=company.name)

    location_parts = []
    if signal.location_city:
        location_parts.append(signal.location_city)
    if signal.location_state:
        location_parts.append(signal.location_state)
    location = ", ".join(location_parts) if location_parts else "United States"

    user_prompt = f"""Write a blog post about this corporate distress event:

**Company**: {company.name}
**Industry**: {company.industry or "Unknown"}
**Sector**: {company.sector or "Unknown"}
**Event Type**: {signal.signal_type}
**Summary**: {signal.summary or signal.title}
**Affected Employees**: {signal.affected_employees or "Unknown"}
**Estimated Devices/Assets**: {signal.device_estimate or "100+"}
**Location**: {location}
**Source**: {signal.source_name}
**Source URL**: {signal.source_url or "N/A"}
**Company Risk Score**: {company.composite_risk_score}/100

**Target Primary Keyword**: {primary_keyword}
**Target Category**: {category}

Write 800-1200 words. Be factual and specific. Include industry-specific asset types that would become available."""

    last_error = None
    for attempt in range(3):
        try:
            response = await client.chat.completions.create(
                model="gpt-4o",
                temperature=0.7,
                max_tokens=8000,
                messages=[
                    {"role": "system", "content": BLOG_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
            text = response.choices[0].message.content.strip()

            # Extract JSON from markdown code blocks if present
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                text = text.rsplit("```", 1)[0]

            return json.loads(text)

        except Exception as e:
            last_error = e
            logger.warning(
                "blog.generation_retry",
                attempt=attempt + 1,
                error=str(e),
            )

    raise RuntimeError(f"Blog generation failed after 3 attempts: {last_error}")


# ---------------------------------------------------------------------------
# Post-processing
# ---------------------------------------------------------------------------


def _post_process(raw: dict, hero_image: dict) -> dict:
    """Transform raw OpenAI output into the full BlogPost JSON schema."""
    post_id = str(uuid.uuid4())
    title = raw.get("title", "Untitled")[:70]
    description = raw.get("description", "")[:165]
    body = raw.get("body", "")

    # Generate slug
    slug = _slugify(title, max_len=80)

    # Extract headings
    headings = []
    for match in re.finditer(r"^(#{2,3})\s+(.+)$", body, re.MULTILINE):
        level = len(match.group(1))
        text = match.group(2).strip()
        heading_id = _slugify(text, max_len=60)
        headings.append({"level": level, "text": text, "id": heading_id})

    # Extract excerpt
    excerpt_text = re.sub(r"[#*_\[\]()]", "", body)  # strip markdown
    excerpt_text = re.sub(r"\s+", " ", excerpt_text).strip()
    excerpt = excerpt_text[:200] + "..." if len(excerpt_text) > 200 else excerpt_text

    # Word count and reading time
    word_count = len(body.split())
    reading_time = max(1, math.ceil(word_count / 250))

    # FAQs
    faqs = raw.get("faqs", [])

    # Sources
    sources = raw.get("sources", [])

    now = datetime.now(timezone.utc).isoformat()

    return {
        "id": post_id,
        "slug": slug,
        "title": title,
        "description": description,
        "excerpt": excerpt,
        "body": body,
        "category": raw.get("category", "industry-analysis"),
        "tags": raw.get("tags", []),
        "primaryKeyword": raw.get("primaryKeyword", ""),
        "author": DEFAULT_AUTHOR,
        "heroImage": hero_image,
        "images": [],
        "headings": headings,
        "faqs": faqs,
        "sources": sources,
        "cta": DEFAULT_CTA,
        "wordCount": word_count,
        "readingTime": reading_time,
        "publishedAt": now,
        "updatedAt": now,
        "isDraft": False,
    }


def _slugify(text: str, max_len: int = 80) -> str:
    """Convert text to URL-safe slug."""
    slug = text.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-")
    if len(slug) > max_len:
        slug = slug[:max_len].rsplit("-", 1)[0]
    return slug


# ---------------------------------------------------------------------------
# Unsplash hero image
# ---------------------------------------------------------------------------


async def _fetch_hero_image(
    http: httpx.AsyncClient, company: Company, signal: Signal
) -> dict:
    """Fetch a hero image from Unsplash API."""
    if not settings.unsplash_access_key:
        return DEFAULT_HERO_IMAGE

    industry = company.industry or "business"
    signal_type = signal.signal_type or "corporate"
    query = f"{industry} {signal_type} corporate"

    try:
        resp = await http.get(
            "https://api.unsplash.com/search/photos",
            params={
                "query": query,
                "per_page": 1,
                "orientation": "landscape",
            },
            headers={
                "Authorization": f"Client-ID {settings.unsplash_access_key}",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])

        if results:
            photo = results[0]
            url = photo["urls"].get("regular", photo["urls"]["raw"])
            alt = photo.get("alt_description", f"{industry} corporate image")
            photographer = photo["user"]["name"]
            username = photo["user"]["username"]
            credit = (
                f"Photo by [{photographer}](https://unsplash.com/@{username}) "
                f"on [Unsplash](https://unsplash.com)"
            )
            return {"url": url, "alt": alt, "credit": credit}

    except Exception as e:
        logger.warning("blog.unsplash_error", error=str(e), query=query)

    return DEFAULT_HERO_IMAGE


# ---------------------------------------------------------------------------
# GitHub publishing
# ---------------------------------------------------------------------------


async def _publish_to_github(http: httpx.AsyncClient, post_json: dict) -> None:
    """Commit blog post JSON + update contentIndex.json via GitHub API."""
    owner, repo = settings.github_repo.split("/")
    branch = settings.github_branch
    slug = post_json["slug"]
    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    api_base = f"https://api.github.com/repos/{owner}/{repo}/contents"

    # Step 1: Commit blog post JSON file
    blog_path = f"frontend/content/blog/{slug}.json"
    blog_content = json.dumps(post_json, indent=2, ensure_ascii=False)
    blog_b64 = base64.b64encode(blog_content.encode()).decode()

    resp = await http.put(
        f"{api_base}/{blog_path}",
        headers=headers,
        json={
            "message": f"blog: {post_json['title'][:50]}",
            "content": blog_b64,
            "branch": branch,
        },
    )
    resp.raise_for_status()
    logger.info("blog.github_file_created", path=blog_path)

    # Step 2: Update contentIndex.json
    index_path = "frontend/content/_system/contentIndex.json"

    # Get current index
    index_resp = await http.get(
        f"{api_base}/{index_path}",
        headers=headers,
        params={"ref": branch},
    )
    index_resp.raise_for_status()
    index_data = index_resp.json()
    index_sha = index_data["sha"]
    current_content = base64.b64decode(index_data["content"]).decode()
    current_index = json.loads(current_content)

    # Build index entry (BlogPostIndex — summary only)
    index_entry = {
        "slug": post_json["slug"],
        "title": post_json["title"],
        "description": post_json["description"],
        "excerpt": post_json["excerpt"],
        "category": post_json["category"],
        "tags": post_json["tags"],
        "heroImage": post_json["heroImage"],
        "readingTime": post_json["readingTime"],
        "publishedAt": post_json["publishedAt"],
        "isDraft": False,
    }

    # Prepend new entry
    current_index.insert(0, index_entry)

    updated_content = json.dumps(current_index, indent=2, ensure_ascii=False)
    updated_b64 = base64.b64encode(updated_content.encode()).decode()

    resp = await http.put(
        f"{api_base}/{index_path}",
        headers=headers,
        json={
            "message": f"blog: update index — {post_json['title'][:40]}",
            "content": updated_b64,
            "sha": index_sha,
            "branch": branch,
        },
    )
    resp.raise_for_status()
    logger.info("blog.github_index_updated", slug=slug)


# ---------------------------------------------------------------------------
# Search engine notifications
# ---------------------------------------------------------------------------


async def _notify_search_engines(http: httpx.AsyncClient, slug: str) -> None:
    """Ping WebSub and IndexNow for fast search engine indexing."""
    blog_url = f"{settings.frontend_url}/blog/{slug}"

    # Google WebSub
    try:
        await http.post(
            "https://pubsubhubbub.appspot.com/",
            data={
                "hub.mode": "publish",
                "hub.url": blog_url,
            },
        )
        logger.info("blog.websub_pinged", url=blog_url)
    except Exception as e:
        logger.warning("blog.websub_error", error=str(e))

    # IndexNow (Bing/Yandex)
    if settings.indexnow_key:
        try:
            await http.post(
                "https://api.indexnow.org/indexnow",
                json={
                    "host": "disposight.com",
                    "key": settings.indexnow_key,
                    "urlList": [blog_url],
                },
            )
            logger.info("blog.indexnow_pinged", url=blog_url)
        except Exception as e:
            logger.warning("blog.indexnow_error", error=str(e))
