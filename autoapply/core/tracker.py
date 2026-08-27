"""
Application tracking database using SQLite.
Stores scraped postings, AI pipeline outputs, generated PDF artifacts, and job statuses.
"""

import json
import logging
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import settings

logger = logging.getLogger(__name__)


class ApplicationTracker:
    """
    SQLite tracker for job applications with Kanban workflow status support.
    """

    STATUS_SCRAPED = "scraped"
    STATUS_TAILORED = "tailored"
    STATUS_APPLIED = "applied"
    STATUS_ACTIVE = "active"
    STATUS_CLOSED = "closed"

    ALL_STATUSES = [STATUS_SCRAPED, STATUS_TAILORED, STATUS_APPLIED, STATUS_ACTIVE, STATUS_CLOSED]

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or settings.db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS applications (
                    id TEXT PRIMARY KEY,
                    url TEXT NOT NULL,
                    company TEXT,
                    role TEXT,
                    source TEXT,
                    date_scraped TIMESTAMP,
                    date_applied TIMESTAMP,
                    status TEXT DEFAULT 'scraped',
                    cv_pdf_path TEXT,
                    cover_pdf_path TEXT,
                    gaps_json TEXT,
                    ai_passes_json TEXT,
                    notes TEXT
                );
            """)
            conn.commit()
            logger.info("Application tracker database initialized.")

    def add_application(
        self,
        url: str,
        company: str,
        role: str,
        source: str = "Web",
        status: str = "scraped",
        cv_pdf_path: str = "",
        cover_pdf_path: str = "",
        gaps_json: str = "{}",
        ai_passes_json: str = "{}",
        notes: str = ""
    ) -> str:
        app_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO applications (
                    id, url, company, role, source, date_scraped, date_applied,
                    status, cv_pdf_path, cover_pdf_path, gaps_json, ai_passes_json, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                app_id, url, company, role, source, now,
                now if status == self.STATUS_APPLIED else None,
                status, cv_pdf_path, cover_pdf_path, gaps_json, ai_passes_json, notes
            ))
            conn.commit()
        return app_id

    def update_status(self, app_id: str, new_status: str):
        now = datetime.now().isoformat() if new_status == self.STATUS_APPLIED else None
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if new_status == self.STATUS_APPLIED:
                cursor.execute("UPDATE applications SET status = ?, date_applied = ? WHERE id = ?", (new_status, now, app_id))
            else:
                cursor.execute("UPDATE applications SET status = ? WHERE id = ?", (new_status, app_id))
            conn.commit()

    def update_notes(self, app_id: str, notes: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE applications SET notes = ? WHERE id = ?", (notes, app_id))
            conn.commit()

    def update_paths(self, app_id: str, cv_path: str, cover_path: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE applications
                SET cv_pdf_path = ?, cover_pdf_path = ?, status = 'tailored'
                WHERE id = ?
            """, (cv_path, cover_path, app_id))
            conn.commit()

    def get_application(self, app_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM applications WHERE id = ?", (app_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_all(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM applications ORDER BY date_scraped DESC")
            return [dict(r) for r in cursor.fetchall()]

    def get_by_status(self, status: str) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM applications WHERE status = ? ORDER BY date_scraped DESC", (status,))
            return [dict(r) for r in cursor.fetchall()]

    def delete(self, app_id: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM applications WHERE id = ?", (app_id,))
            conn.commit()

    def get_statistics(self) -> Dict[str, Any]:
        """Calculates dashboard metrics."""
        all_apps = self.get_all()
        total = len(all_apps)
        status_counts = {s: 0 for s in self.ALL_STATUSES}
        
        for app in all_apps:
            st = app.get("status", self.STATUS_SCRAPED)
            if st in status_counts:
                status_counts[st] += 1
            else:
                status_counts[self.STATUS_SCRAPED] += 1

        applied_and_beyond = status_counts[self.STATUS_APPLIED] + status_counts[self.STATUS_ACTIVE] + status_counts[self.STATUS_CLOSED]
        response_rate = (status_counts[self.STATUS_ACTIVE] / applied_and_beyond * 100.0) if applied_and_beyond > 0 else 0.0

        return {
            "total": total,
            "counts": status_counts,
            "response_rate": round(response_rate, 1),
            "applied_count": applied_and_beyond
        }
