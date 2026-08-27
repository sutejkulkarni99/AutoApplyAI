"""
Dashboard Tab: Kanban Board for tracking job applications.
Features 5 workflow stages: Scraped -> Tailored -> Applied -> Active -> Closed.
Includes analytics, response rate stats, search filters, and right-click actions.
"""

import json
import logging
from typing import Any, Dict, List
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QComboBox, QScrollArea, QFrame, QMenu,
    QMessageBox, QInputDialog, QGridLayout
)

from core.tracker import ApplicationTracker

logger = logging.getLogger(__name__)


class ApplicationCard(QFrame):
    """Visual card representing a single tracked job application."""
    status_changed = pyqtSignal(str, str)
    refresh_requested = pyqtSignal()

    def __init__(self, app_data: Dict[str, Any], parent=None):
        super().__init__(parent)
        self.app_data = app_data
        self.setFrameShape(QFrame.Shape.StyledPanel)
        self.setStyleSheet("""
            ApplicationCard {
                background-color: #21262d;
                border: 1px solid #30363d;
                border-radius: 6px;
                padding: 10px;
            }
            ApplicationCard:hover {
                border-color: #58a6ff;
            }
        """)
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(4)

        # Company and Role
        self.role_lbl = QLabel(self.app_data.get("role", "Role Title"))
        self.role_lbl.setStyleSheet("font-weight: bold; color: #f0f6fc; font-size: 13px;")
        
        self.company_lbl = QLabel(self.app_data.get("company", "Company"))
        self.company_lbl.setStyleSheet("color: #58a6ff; font-weight: 500;")

        # Date & Source
        date_str = str(self.app_data.get("date_scraped", ""))[:10]
        self.meta_lbl = QLabel(f"Scraped: {date_str} | {self.app_data.get('source', 'Web')}")
        self.meta_lbl.setStyleSheet("color: #8b949e; font-size: 11px;")

        layout.addWidget(self.role_lbl)
        layout.addWidget(self.company_lbl)
        layout.addWidget(self.meta_lbl)

        # Gaps warning indicator
        gaps_raw = self.app_data.get("gaps_json", "{}")
        try:
            gaps = json.loads(gaps_raw)
            if gaps.get("missing_skills"):
                gap_lbl = QLabel(f"⚠ {len(gaps['missing_skills'])} Skill Gap(s) Flagged")
                gap_lbl.setStyleSheet("color: #e3b341; font-size: 11px; font-weight: bold;")
                layout.addWidget(gap_lbl)
        except Exception:
            pass

    def contextMenuEvent(self, event):
        menu = QMenu(self)
        
        change_status_menu = menu.addMenu("Move Status")
        for st in ApplicationTracker.ALL_STATUSES:
            if st != self.app_data.get("status"):
                action = change_status_menu.addAction(st.capitalize())
                action.triggered.connect(lambda checked, s=st: self.move_to_status(s))

        edit_notes_action = menu.addAction("Edit Notes")
        edit_notes_action.triggered.connect(self.edit_notes)

        delete_action = menu.addAction("Delete")
        delete_action.triggered.connect(self.delete_app)

        menu.exec(event.globalPos())

    def move_to_status(self, new_status: str):
        tracker = ApplicationTracker()
        tracker.update_status(self.app_data["id"], new_status)
        self.refresh_requested.emit()

    def edit_notes(self):
        current_notes = self.app_data.get("notes", "")
        text, ok = QInputDialog.getMultiLineText(self, "Edit Application Notes", "Notes / Interview Log:", current_notes)
        if ok:
            tracker = ApplicationTracker()
            tracker.update_notes(self.app_data["id"], text)
            self.refresh_requested.emit()

    def delete_app(self):
        confirm = QMessageBox.question(self, "Confirm Delete", f"Delete application for {self.app_data.get('company')}?", QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
        if confirm == QMessageBox.StandardButton.Yes:
            tracker = ApplicationTracker()
            tracker.delete(self.app_data["id"])
            self.refresh_requested.emit()


class DashboardTab(QWidget):
    """
    Kanban Board Dashboard.
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        self.tracker = ApplicationTracker()
        self.column_layouts: Dict[str, QVBoxLayout] = {}
        self.init_ui()
        self.refresh_data()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # 1. Top Metrics Bar
        self.metrics_frame = QFrame()
        self.metrics_frame.setStyleSheet("""
            QFrame {
                background-color: #161b22;
                border: 1px solid #30363d;
                border-radius: 6px;
                padding: 10px;
            }
        """)
        metrics_layout = QHBoxLayout(self.metrics_frame)

        self.total_lbl = QLabel("Total Tracked: 0")
        self.total_lbl.setStyleSheet("font-size: 14px; font-weight: bold; color: #f0f6fc;")

        self.applied_lbl = QLabel("Applied: 0")
        self.applied_lbl.setStyleSheet("font-size: 14px; color: #58a6ff;")

        self.response_lbl = QLabel("Response Rate: 0.0%")
        self.response_lbl.setStyleSheet("font-size: 14px; color: #3fb950; font-weight: bold;")

        metrics_layout.addWidget(self.total_lbl)
        metrics_layout.addWidget(self.applied_lbl)
        metrics_layout.addWidget(self.response_lbl)
        metrics_layout.addStretch()

        # Refresh button
        self.refresh_btn = QPushButton("Refresh Board")
        self.refresh_btn.clicked.connect(self.refresh_data)
        metrics_layout.addWidget(self.refresh_btn)

        layout.addWidget(self.metrics_frame)

        # 2. Filter & Search Controls
        filter_row = QHBoxLayout()
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Search company, role, or keywords...")
        self.search_input.textChanged.connect(self.filter_cards)

        filter_row.addWidget(QLabel("Search:"))
        filter_row.addWidget(self.search_input, stretch=1)
        layout.addLayout(filter_row)

        # 3. Kanban 5 Columns
        kanban_grid = QHBoxLayout()
        kanban_grid.setSpacing(10)

        statuses = [
            (ApplicationTracker.STATUS_SCRAPED, "1. Scraped", "#8b949e"),
            (ApplicationTracker.STATUS_TAILORED, "2. Tailored", "#58a6ff"),
            (ApplicationTracker.STATUS_APPLIED, "3. Applied", "#d29922"),
            (ApplicationTracker.STATUS_ACTIVE, "4. Active / Interview", "#3fb950"),
            (ApplicationTracker.STATUS_CLOSED, "5. Closed", "#f85149")
        ]

        for st_key, st_title, color in statuses:
            col_box = QFrame()
            col_box.setStyleSheet(f"""
                QFrame {{
                    background-color: #0d1117;
                    border: 1px solid #30363d;
                    border-top: 3px solid {color};
                    border-radius: 6px;
                }}
            """)
            col_layout = QVBoxLayout(col_box)
            col_layout.setContentsMargins(6, 6, 6, 6)

            header_lbl = QLabel(st_title)
            header_lbl.setStyleSheet(f"font-weight: bold; color: {color}; padding: 4px;")
            col_layout.addWidget(header_lbl)

            scroll = QScrollArea()
            scroll.setWidgetResizable(True)
            scroll.setStyleSheet("border: none; background: transparent;")

            scroll_content = QWidget()
            card_layout = QVBoxLayout(scroll_content)
            card_layout.setSpacing(8)
            card_layout.setContentsMargins(2, 2, 2, 2)
            card_layout.addStretch()

            scroll.setWidget(scroll_content)
            col_layout.addWidget(scroll)

            self.column_layouts[st_key] = card_layout
            kanban_grid.addWidget(col_box)

        layout.addLayout(kanban_grid, stretch=1)

    def refresh_data(self):
        """Reloads all applications and redraws Kanban cards."""
        stats = self.tracker.get_statistics()
        self.total_lbl.setText(f"Total Tracked: {stats['total']}")
        self.applied_lbl.setText(f"Applied: {stats['applied_count']}")
        self.response_lbl.setText(f"Response Rate: {stats['response_rate']}%")

        # Clear existing cards in all column layouts
        for st_key, layout in self.column_layouts.items():
            while layout.count() > 1:
                item = layout.takeAt(0)
                if item.widget():
                    item.widget().deleteLater()

        # Populate fresh cards
        apps = self.tracker.get_all()
        for app in apps:
            st = app.get("status", ApplicationTracker.STATUS_SCRAPED)
            if st in self.column_layouts:
                card = ApplicationCard(app)
                card.refresh_requested.connect(self.refresh_data)
                self.column_layouts[st].insertWidget(self.column_layouts[st].count() - 1, card)

    def filter_cards(self, query: str):
        q = query.lower().strip()
        for st_key, layout in self.column_layouts.items():
            for i in range(layout.count() - 1):
                item = layout.itemAt(i)
                if item and item.widget():
                    card = item.widget()
                    if isinstance(card, ApplicationCard):
                        text = f"{card.app_data.get('company', '')} {card.app_data.get('role', '')}".lower()
                        card.setVisible(q in text if q else True)
