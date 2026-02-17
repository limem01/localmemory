from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
import logging

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

scheduler = AsyncIOScheduler(timezone="UTC")


def setup_scheduler():
    """Configure and register all scheduled jobs."""

    # Daily digest job
    scheduler.add_job(
        run_daily_digest,
        CronTrigger(hour=settings.digest_hour, minute=settings.digest_minute),
        id="daily_digest",
        name="Daily Memory Digest",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Watched folder scan (every 2 minutes)
    scheduler.add_job(
        scan_watched_folder,
        IntervalTrigger(minutes=2),
        id="folder_scan",
        name="Watched Folder Scanner",
        replace_existing=True,
    )

    logger.info("Scheduled jobs configured")


async def run_daily_digest():
    """Generate and store daily digest of recent memories."""
    try:
        from app.services.proactive import ProactiveService
        from app.core.database import SessionLocal

        db = SessionLocal()
        try:
            service = ProactiveService(db)
            digest = await service.generate_daily_digest()
            if digest:
                logger.info(f"Daily digest generated: {len(digest)} chars")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Daily digest failed: {e}", exc_info=True)


async def scan_watched_folder():
    """Scan watched folder for new files and ingest them."""
    try:
        import os
        from app.services.ingestion import IngestionService
        from app.core.database import SessionLocal

        watch_dir = settings.watched_dir
        if not os.path.exists(watch_dir):
            return

        db = SessionLocal()
        try:
            service = IngestionService(db)
            await service.ingest_watched_folder(watch_dir)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Folder scan failed: {e}", exc_info=True)
