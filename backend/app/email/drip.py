"""Drip email sequence for new signups.

Sequence (3-day trial):
  Immediate — Welcome email
  +24 hours — Value email (top deals from platform)
  +48 hours — Tips email (features walkthrough)
  +72 hours — Trial expiring email (urgency + upgrade CTA)

Each email is tracked via User.metadata_ to avoid duplicates.
"""

from datetime import datetime, timedelta, timezone

import resend
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Company, Signal, Tenant, User

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Shared styles
# ---------------------------------------------------------------------------
_WRAPPER = (
    'style="font-family: system-ui, -apple-system, sans-serif; '
    "max-width: 600px; margin: 0 auto; background: #09090B; "
    'color: #FAFAFA; padding: 32px; border-radius: 8px;"'
)
_ACCENT = "#10B981"
_MUTED = "#71717A"
_SURFACE = "#18181B"
_CTA = (
    f"display: inline-block; background: {_ACCENT}; color: #fff; "
    "padding: 12px 24px; border-radius: 6px; text-decoration: none; "
    "font-weight: 600; font-size: 14px;"
)
_FOOTER = (
    f'<p style="color: {_MUTED}; font-size: 11px; margin-top: 32px; '
    f'border-top: 1px solid #27272A; padding-top: 16px;">'
    "You're receiving this because you signed up for DispoSight. "
    '<a href="{url}/dashboard/settings" style="color: #6EE7B7;">Manage preferences</a>'
    "</p>"
)


def _footer() -> str:
    return _FOOTER.replace("{url}", settings.frontend_url)


# ---------------------------------------------------------------------------
# Email 1: Welcome (sent immediately on signup)
# ---------------------------------------------------------------------------
def _welcome_html(user: User, trial_end: str) -> str:
    name = (user.full_name or "").split()[0] or "there"
    return f"""
    <div {_WRAPPER}>
        <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: {_ACCENT}; margin: 0; font-size: 28px;">Welcome to DispoSight</h1>
            <p style="color: #A1A1AA; margin: 8px 0 0 0;">Corporate distress intelligence, delivered.</p>
        </div>

        <p style="font-size: 15px; line-height: 1.6;">
            Hey {name}, thanks for signing up. You've got <strong style="color: {_ACCENT};">3 days of full access</strong>
            to the platform — every signal, every deal score, every contact.
        </p>

        <div style="background: {_SURFACE}; padding: 20px; border-radius: 8px; margin: 24px 0;">
            <p style="margin: 0 0 12px 0; font-weight: 600; color: {_ACCENT};">What you can do right now:</p>
            <table style="width: 100%; font-size: 14px; line-height: 1.8;">
                <tr><td style="padding: 2px 0;">📡</td><td style="padding: 2px 8px;">Browse real-time distress signals from WARN Act, SEC, courts & news</td></tr>
                <tr><td style="padding: 2px 0;">🎯</td><td style="padding: 2px 8px;">See AI-scored deal opportunities ranked by value</td></tr>
                <tr><td style="padding: 2px 0;">🔔</td><td style="padding: 2px 8px;">Set up alerts so you never miss a deal</td></tr>
                <tr><td style="padding: 2px 0;">👤</td><td style="padding: 2px 8px;">Find decision-maker contacts at distressed companies</td></tr>
            </table>
        </div>

        <div style="text-align: center; margin: 28px 0;">
            <a href="{settings.frontend_url}/dashboard" style="{_CTA}">Open Your Dashboard</a>
        </div>

        <p style="color: #A1A1AA; font-size: 13px; text-align: center;">
            Your trial runs until <strong>{trial_end}</strong>. No credit card required.
        </p>

        {_footer()}
    </div>
    """


# ---------------------------------------------------------------------------
# Email 2: Value (sent ~24h after signup)
# ---------------------------------------------------------------------------
def _value_html(user: User, deals: list[dict]) -> str:
    name = (user.full_name or "").split()[0] or "there"

    rows = ""
    for d in deals[:5]:
        score_color = "#EF4444" if d["score"] >= 85 else "#F97316" if d["score"] >= 70 else "#EAB308"
        rows += f"""
        <tr>
            <td style="padding: 10px 8px; border-bottom: 1px solid #27272A; font-weight: 500;">{d['name']}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #27272A; color: #A1A1AA; font-size: 13px;">{d['type']}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #27272A; font-family: monospace; font-weight: 700; color: {score_color};">{d['score']}</td>
        </tr>
        """

    no_deals = """
        <p style="color: #A1A1AA; text-align: center; padding: 16px;">
            We're processing new signals right now. Check your dashboard for the latest.
        </p>
    """

    return f"""
    <div {_WRAPPER}>
        <h2 style="color: {_ACCENT}; margin: 0 0 8px 0;">Today's Top Deals</h2>
        <p style="color: #A1A1AA; margin: 0 0 24px 0;">Here's what DispoSight found for you, {name}.</p>

        {f'''
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="color: {_MUTED}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">
                <th style="text-align: left; padding: 8px;">Company</th>
                <th style="text-align: left; padding: 8px;">Signal</th>
                <th style="text-align: left; padding: 8px;">Score</th>
            </tr>
            {rows}
        </table>
        ''' if deals else no_deals}

        <div style="text-align: center; margin: 28px 0;">
            <a href="{settings.frontend_url}/dashboard" style="{_CTA}">View All Deals</a>
        </div>

        <div style="background: {_SURFACE}; padding: 16px; border-radius: 8px; margin: 24px 0;">
            <p style="margin: 0; font-size: 13px; color: #A1A1AA;">
                💡 <strong style="color: #FAFAFA;">Pro tip:</strong> Set up a
                <a href="{settings.frontend_url}/dashboard/alerts" style="color: #6EE7B7;">real-time alert</a>
                to get notified the moment a new deal matches your criteria.
            </p>
        </div>

        {_footer()}
    </div>
    """


# ---------------------------------------------------------------------------
# Email 3: Tips (sent ~48h after signup)
# ---------------------------------------------------------------------------
def _tips_html(user: User) -> str:
    name = (user.full_name or "").split()[0] or "there"
    return f"""
    <div {_WRAPPER}>
        <h2 style="color: {_ACCENT}; margin: 0 0 8px 0;">3 Ways to Find Deals Faster</h2>
        <p style="color: #A1A1AA; margin: 0 0 24px 0;">{name}, here's how top users get the most out of DispoSight.</p>

        <div style="background: {_SURFACE}; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0 0 4px 0; font-weight: 600; font-size: 15px;">1. Build Your Watchlist</p>
            <p style="margin: 0; color: #A1A1AA; font-size: 14px; line-height: 1.6;">
                Add companies you're tracking to your watchlist. You'll see them in your pipeline
                and get notified when new signals drop.
            </p>
        </div>

        <div style="background: {_SURFACE}; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0 0 4px 0; font-weight: 600; font-size: 15px;">2. Set Up Smart Alerts</p>
            <p style="margin: 0; color: #A1A1AA; font-size: 14px; line-height: 1.6;">
                Filter by signal type (bankruptcy, layoff, closure), state, and severity.
                Get real-time emails or daily digests — your call.
            </p>
        </div>

        <div style="background: {_SURFACE}; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0 0 4px 0; font-weight: 600; font-size: 15px;">3. Find Decision-Makers</p>
            <p style="margin: 0; color: #A1A1AA; font-size: 14px; line-height: 1.6;">
                Click "Find Contacts" on any company to discover executives with validated
                emails and phone numbers. Skip the gatekeepers.
            </p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
            <a href="{settings.frontend_url}/dashboard/watchlist" style="{_CTA}">Start Your Watchlist</a>
        </div>

        <p style="color: #A1A1AA; font-size: 13px; text-align: center;">
            ⏰ Your trial ends tomorrow. Make the most of it.
        </p>

        {_footer()}
    </div>
    """


# ---------------------------------------------------------------------------
# Email 4: Trial expiring (sent ~72h / day of expiry)
# ---------------------------------------------------------------------------
def _trial_expiring_html(user: User) -> str:
    name = (user.full_name or "").split()[0] or "there"
    return f"""
    <div {_WRAPPER}>
        <h2 style="color: #F97316; margin: 0 0 8px 0;">Your Trial Ends Today</h2>
        <p style="color: #A1A1AA; margin: 0 0 24px 0;">{name}, your full access to DispoSight expires today.</p>

        <div style="background: {_SURFACE}; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <p style="margin: 0 0 12px 0; font-weight: 600;">After today, you'll lose access to:</p>
            <table style="width: 100%; font-size: 14px; line-height: 1.8;">
                <tr><td style="padding: 2px 0; color: #EF4444;">✕</td><td style="padding: 2px 8px;">Real-time distress signals across 4 pipelines</td></tr>
                <tr><td style="padding: 2px 0; color: #EF4444;">✕</td><td style="padding: 2px 8px;">AI-scored deal opportunities and rankings</td></tr>
                <tr><td style="padding: 2px 0; color: #EF4444;">✕</td><td style="padding: 2px 8px;">Decision-maker contact discovery</td></tr>
                <tr><td style="padding: 2px 0; color: #EF4444;">✕</td><td style="padding: 2px 8px;">Email alerts and intelligence digests</td></tr>
                <tr><td style="padding: 2px 0; color: #EF4444;">✕</td><td style="padding: 2px 8px;">Pipeline management and deal tracking</td></tr>
            </table>
        </div>

        <div style="text-align: center; margin: 28px 0;">
            <a href="{settings.frontend_url}/dashboard/settings" style="{_CTA} background: #F97316;">Upgrade Now</a>
        </div>

        <p style="color: #A1A1AA; font-size: 13px; text-align: center;">
            Professional plan — $199/mo. Cancel anytime.<br>
            <a href="{settings.frontend_url}/pricing" style="color: #6EE7B7;">Compare plans →</a>
        </p>

        {_footer()}
    </div>
    """


# ---------------------------------------------------------------------------
# Sending logic
# ---------------------------------------------------------------------------
def _get_drip_state(user: User) -> dict:
    """Get the drip email state from user metadata."""
    meta = user.metadata_ or {}
    return meta.get("drip", {})


def _set_drip_state(user: User, key: str):
    """Mark a drip email as sent in user metadata."""
    if user.metadata_ is None:
        user.metadata_ = {}
    if "drip" not in user.metadata_:
        user.metadata_["drip"] = {}
    user.metadata_["drip"][key] = datetime.now(timezone.utc).isoformat()

    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(user, "metadata_")


def _send(to: str, subject: str, html: str) -> bool:
    """Send an email via Resend. Returns True on success."""
    if not settings.resend_api_key:
        logger.warning("drip.skipped", reason="no_resend_key", to=to)
        return False

    try:
        resend.api_key = settings.resend_api_key
        resend.Emails.send({
            "from": settings.from_email,
            "to": to,
            "subject": subject,
            "html": html,
        })
        logger.info("drip.sent", to=to, subject=subject)
        return True
    except Exception as e:
        logger.error("drip.failed", to=to, subject=subject, error=str(e))
        return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
async def send_welcome_email(user: User, tenant: Tenant):
    """Send the welcome email immediately after signup."""
    drip = _get_drip_state(user)
    if "welcome" in drip:
        return

    trial_end = ""
    if tenant.trial_ends_at:
        trial_end = tenant.trial_ends_at.strftime("%B %d, %Y")

    html = _welcome_html(user, trial_end)
    if _send(user.email, "Welcome to DispoSight — Your 3-Day Trial Starts Now", html):
        _set_drip_state(user, "welcome")


async def process_drip_emails(db: AsyncSession):
    """Process drip emails for all trialing users. Run via cron every hour."""
    now = datetime.now(timezone.utc)

    # Get all users on trialing tenants
    result = await db.execute(
        select(User, Tenant)
        .join(Tenant, Tenant.id == User.tenant_id)
        .where(Tenant.plan == "trialing")
    )
    rows = result.all()

    stats = {"value": 0, "tips": 0, "expiring": 0, "skipped": 0}

    for user, tenant in rows:
        drip = _get_drip_state(user)
        signup_at = user.created_at.replace(tzinfo=timezone.utc) if user.created_at.tzinfo is None else user.created_at
        hours_since_signup = (now - signup_at).total_seconds() / 3600

        # Email 2: Value email (~24h after signup)
        if "value" not in drip and hours_since_signup >= 22:
            deals = await _get_top_deals(db)
            html = _value_html(user, deals)
            if _send(user.email, "Today's Top Distress Deals — DispoSight", html):
                _set_drip_state(user, "value")
                stats["value"] += 1
            continue

        # Email 3: Tips email (~48h after signup)
        if "tips" not in drip and "value" in drip and hours_since_signup >= 46:
            html = _tips_html(user)
            if _send(user.email, "3 Ways to Find Deals Faster — DispoSight", html):
                _set_drip_state(user, "tips")
                stats["tips"] += 1
            continue

        # Email 4: Trial expiring (~72h / day of expiry)
        if "expiring" not in drip and "tips" in drip and hours_since_signup >= 70:
            html = _trial_expiring_html(user)
            if _send(user.email, "Your DispoSight Trial Ends Today", html):
                _set_drip_state(user, "expiring")
                stats["expiring"] += 1
            continue

        stats["skipped"] += 1

    await db.flush()

    total_sent = stats["value"] + stats["tips"] + stats["expiring"]
    if total_sent > 0:
        logger.info("drip.batch_complete", **stats)

    return stats


async def _get_top_deals(db: AsyncSession) -> list[dict]:
    """Get top 5 deals by severity for the value email."""
    result = await db.execute(
        select(Signal, Company)
        .join(Company, Company.id == Signal.company_id)
        .where(Signal.device_estimate.isnot(None))
        .where(Company.normalized_name != "unknown")
        .order_by(Signal.severity_score.desc())
        .limit(5)
    )
    rows = result.all()

    return [
        {
            "name": company.name,
            "type": signal.signal_type.replace("_", " ").title(),
            "score": signal.severity_score,
        }
        for signal, company in rows
    ]
