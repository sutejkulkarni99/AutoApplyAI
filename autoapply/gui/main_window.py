"""
Main Window for AutoApply PyQt6 Desktop Application.
Features a modern dark stylesheet, 3 core tabs, settings dialog, menu bar, and live status rate limit indicators.
"""

import sys
from pathlib import Path
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QAction, QIcon
from PyQt6.QtWidgets import (
    QMainWindow, QTabWidget, QStatusBar, QLabel,
    QMenuBar, QMenu, QMessageBox, QDialog, QVBoxLayout,
    QLineEdit, QDialogButtonBox, QWidget
)

from config import settings
from core.ai_client import RateLimiter
from gui.input_tab import InputTab
from gui.preview_tab import PreviewTab
from gui.dashboard_tab import DashboardTab

DARK_STYLESHEET = """
QMainWindow {
    background-color: #0d1117;
    color: #c9d1d9;
}
QWidget {
    background-color: #0d1117;
    color: #c9d1d9;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 13px;
}
QTabWidget::pane {
    border: 1px solid #30363d;
    background-color: #161b22;
    border-radius: 6px;
}
QTabBar::tab {
    background: #0d1117;
    color: #8b949e;
    padding: 10px 20px;
    border: 1px solid transparent;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    font-weight: 500;
}
QTabBar::tab:selected {
    background: #161b22;
    color: #58a6ff;
    border-bottom: 2px solid #58a6ff;
}
QTabBar::tab:hover {
    color: #f0f6fc;
}
QGroupBox {
    background-color: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    margin-top: 12px;
    padding: 12px;
    font-weight: 600;
    color: #f0f6fc;
}
QGroupBox::title {
    subcontrol-origin: margin;
    left: 12px;
    padding: 0 4px;
}
QLineEdit, QTextEdit, QComboBox {
    background-color: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 8px;
    color: #f0f6fc;
    selection-background-color: #1f6feb;
}
QLineEdit:focus, QTextEdit:focus, QComboBox:focus {
    border: 1px solid #58a6ff;
}
QPushButton {
    background-color: #21262d;
    color: #c9d1d9;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 7px 16px;
    font-weight: 600;
}
QPushButton:hover {
    background-color: #30363d;
    border-color: #8b949e;
}
QPushButton#primaryActionButton {
    background-color: #238636;
    color: #ffffff;
    border: 1px solid rgba(240, 246, 252, 0.1);
}
QPushButton#primaryActionButton:hover {
    background-color: #2ea043;
}
QPushButton#accentButton {
    background-color: #1f6feb;
    color: #ffffff;
    border: 1px solid rgba(240, 246, 252, 0.1);
}
QPushButton#accentButton:hover {
    background-color: #388bfd;
}
QProgressBar {
    border: 1px solid #30363d;
    border-radius: 6px;
    text-align: center;
    background-color: #0d1117;
    color: #f0f6fc;
}
QProgressBar::chunk {
    background-color: #238636;
    border-radius: 5px;
}
QStatusBar {
    background-color: #161b22;
    border-top: 1px solid #30363d;
    color: #8b949e;
}
QMenuBar {
    background-color: #161b22;
    border-bottom: 1px solid #30363d;
    color: #c9d1d9;
}
QMenuBar::item:selected {
    background-color: #30363d;
}
QMenu {
    background-color: #161b22;
    border: 1px solid #30363d;
    color: #c9d1d9;
}
QMenu::item:selected {
    background-color: #1f6feb;
    color: #ffffff;
}
"""


class SettingsDialog(QDialog):
    """Dialog for adjusting API key and rate limits."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("AutoApply Settings")
        self.resize(500, 260)
        layout = QVBoxLayout(self)

        layout.addWidget(QLabel("Google AI Studio API Key:"))
        self.key_input = QLineEdit()
        self.key_input.setEchoMode(QLineEdit.EchoMode.Password)
        self.key_input.setText(settings.google_ai_studio_api_key)
        layout.addWidget(self.key_input)

        layout.addWidget(QLabel("AI Model:"))
        from PyQt6.QtWidgets import QComboBox
        self.model_combo = QComboBox()
        models = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-flash-latest"]
        self.model_combo.addItems(models)
        if settings.ai_model in models:
            self.model_combo.setCurrentText(settings.ai_model)
        else:
            self.model_combo.addItem(settings.ai_model)
            self.model_combo.setCurrentText(settings.ai_model)
        layout.addWidget(self.model_combo)

        layout.addWidget(QLabel(f"LaTeX Compiler: {settings.latex_compiler}"))

        btn_box = QDialogButtonBox(QDialogButtonBox.StandardButton.Save | QDialogButtonBox.StandardButton.Cancel)
        btn_box.accepted.connect(self.save)
        btn_box.rejected.connect(self.reject)
        layout.addWidget(btn_box)

    def save(self):
        new_key = self.key_input.text().strip()
        settings.google_ai_studio_api_key = new_key
        settings.ai_model = self.model_combo.currentText().strip()
        self.accept()


class MainWindow(QMainWindow):
    """
    Main application window hosting Input, Preview, and Dashboard tabs.
    """

    def __init__(self):
        super().__init__()
        self.setWindowTitle("AutoApply — Python GUI Job Application Assistant")
        self.setMinimumSize(1200, 800)
        self.setStyleSheet(DARK_STYLESHEET)

        self.init_menu_bar()
        self.init_tabs()
        self.init_status_bar()

        # Timer for updating status rate limits
        self.status_timer = QTimer(self)
        self.status_timer.timeout.connect(self.update_rate_limit_display)
        self.status_timer.start(2000)

    def init_menu_bar(self):
        menu_bar = self.menuBar()

        # File Menu
        file_menu = menu_bar.addMenu("&File")
        exit_action = QAction("Exit", self)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)

        # Settings Menu
        settings_menu = menu_bar.addMenu("&Settings")
        config_action = QAction("API & Compiler Settings", self)
        config_action.triggered.connect(self.open_settings)
        settings_menu.addAction(config_action)

        # Help Menu
        help_menu = menu_bar.addMenu("&Help")
        about_action = QAction("About AutoApply", self)
        about_action.triggered.connect(self.show_about)
        help_menu.addAction(about_action)

    def init_tabs(self):
        self.tab_widget = QTabWidget()
        self.setCentralWidget(self.tab_widget)

        self.input_tab = InputTab(self)
        self.preview_tab = PreviewTab(self)
        self.dashboard_tab = DashboardTab(self)

        self.tab_widget.addTab(self.input_tab, "1. Job Input & AI Pipeline")
        self.tab_widget.addTab(self.preview_tab, "2. Tailored Documents & Preview")
        self.tab_widget.addTab(self.dashboard_tab, "3. Application Kanban Tracker")

        # Connect signals
        self.input_tab.pipeline_completed.connect(self.on_pipeline_completed)
        self.preview_tab.application_saved.connect(self.dashboard_tab.refresh_data)

    def init_status_bar(self):
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)

        self.ready_status_lbl = QLabel("Ready")
        self.rate_limit_lbl = QLabel(f"Rate Limit: {settings.rate_limit_rpm} RPM Max | Queue: 0")
        self.rate_limit_lbl.setStyleSheet("color: #58a6ff;")

        self.status_bar.addWidget(self.ready_status_lbl, stretch=1)
        self.status_bar.addPermanentWidget(self.rate_limit_lbl)

    def update_rate_limit_display(self):
        self.rate_limit_lbl.setText(f"AI Model: {settings.ai_model} | Rate Safe: {settings.rate_limit_rpm} RPM")

    def on_pipeline_completed(self, results):
        self.preview_tab.load_pipeline_results(results)
        self.tab_widget.setCurrentIndex(1)  # Auto switch to Preview tab

    def open_settings(self):
        dialog = SettingsDialog(self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            QMessageBox.information(self, "Settings Updated", "Configuration saved.")

    def show_about(self):
        QMessageBox.about(
            self,
            "About AutoApply",
            "AutoApply — Python GUI Job Application Assistant\n"
            "Powered by Google AI Studio (Gemini 2.5 Flash).\n\n"
            "Features:\n"
            "• Zero-hallucination profile validation\n"
            "• 2-page CV & 1-page Cover Letter enforcement\n"
            "• Jinja2 LaTeX injection into sacred templates\n"
            "• Kanban Application Tracker"
        )
