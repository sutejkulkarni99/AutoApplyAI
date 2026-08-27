"""
Input tab for job scraping, manual job description input, template selection, and triggering the 3-pass pipeline.
"""

import logging
from typing import Any, Callable, Dict, Optional
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QTextEdit, QComboBox, QProgressBar,
    QGroupBox, QMessageBox, QFrame
)

from core.scraper import JobScraper
from core.content_generator import ContentGenerator

logger = logging.getLogger(__name__)


class PipelineWorker(QThread):
    """Worker thread to run AI pipeline without freezing the PyQt GUI."""
    progress_signal = pyqtSignal(str, int)
    finished_signal = pyqtSignal(dict)
    error_signal = pyqtSignal(str)

    def __init__(self, job_desc: str):
        super().__init__()
        self.job_desc = job_desc

    def run(self):
        try:
            generator = ContentGenerator()
            
            def progress_cb(msg: str, percent: int):
                self.progress_signal.emit(msg, percent)

            result = generator.run_full_pipeline(self.job_desc, progress_cb)
            self.finished_signal.emit(result)
        except Exception as e:
            self.error_signal.emit(str(e))


class ScraperWorker(QThread):
    """Worker thread for scraping job URLs."""
    finished_signal = pyqtSignal(dict)
    error_signal = pyqtSignal(str)

    def __init__(self, url: str):
        super().__init__()
        self.url = url

    def run(self):
        try:
            scraper = JobScraper()
            res = scraper.scrape_url(self.url)
            self.finished_signal.emit(res)
        except Exception as e:
            self.error_signal.emit(str(e))


class InputTab(QWidget):
    """
    Input and Scraping Tab.
    """
    pipeline_completed = pyqtSignal(dict)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.scraped_metadata: Dict[str, Any] = {}
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.setContentsMargins(16, 16, 16, 16)

        # Top Group: Job URL and Scraping Actions
        url_group = QGroupBox("1. Target Job Source")
        url_layout = QVBoxLayout(url_group)

        url_input_row = QHBoxLayout()
        self.url_label = QLabel("Job Posting URL:")
        self.url_input = QLineEdit()
        self.url_input.setPlaceholderText("https://www.linkedin.com/jobs/view/... or StepStone / Company URL")
        
        self.scrape_btn = QPushButton("Scrape URL")
        self.scrape_btn.setObjectName("accentButton")
        self.scrape_btn.clicked.connect(self.start_scraping)

        self.paste_btn = QPushButton("Paste JD Manually")
        self.paste_btn.clicked.connect(self.handle_manual_paste)

        url_input_row.addWidget(self.url_label)
        url_input_row.addWidget(self.url_input, stretch=1)
        url_input_row.addWidget(self.scrape_btn)
        url_input_row.addWidget(self.paste_btn)
        url_layout.addLayout(url_input_row)

        layout.addWidget(url_group)

        # Middle Group: Template & Options
        config_group = QGroupBox("2. Configuration & Pipeline Execution")
        config_layout = QHBoxLayout(config_group)

        template_lbl = QLabel("Template Variant:")
        self.template_combo = QComboBox()
        self.template_combo.addItems([
            "Modern Technical (Standard LaTeX 2-Page CV)",
            "Executive Minimalist (LaTeX Cover + CV)"
        ])

        self.process_btn = QPushButton("Process Job (Run 3-Pass AI)")
        self.process_btn.setObjectName("primaryActionButton")
        self.process_btn.setMinimumHeight(38)
        self.process_btn.clicked.connect(self.start_pipeline)

        config_layout.addWidget(template_lbl)
        config_layout.addWidget(self.template_combo, stretch=1)
        config_layout.addWidget(self.process_btn)

        layout.addWidget(config_group)

        # Bottom Group: Job Description Editor
        jd_group = QGroupBox("3. Extracted Job Description Content")
        jd_layout = QVBoxLayout(jd_group)

        self.jd_text = QTextEdit()
        self.jd_text.setPlaceholderText("Scraped job posting text or manual job description will appear here...")
        jd_layout.addWidget(self.jd_text)

        layout.addWidget(jd_group, stretch=1)

        # Progress bar and status logs
        self.progress_bar = QProgressBar()
        self.progress_bar.setValue(0)
        self.progress_bar.setTextVisible(True)
        self.progress_bar.hide()
        layout.addWidget(self.progress_bar)

        self.log_label = QLabel("Status: Ready to scrape or enter job description.")
        self.log_label.setStyleSheet("color: #8b949e; font-size: 12px;")
        layout.addWidget(self.log_label)

    def handle_manual_paste(self):
        self.jd_text.setFocus()
        self.log_label.setText("Status: Paste your job description into the text area below.")

    def start_scraping(self):
        url = self.url_input.text().strip()
        if not url:
            QMessageBox.warning(self, "Missing URL", "Please enter a valid job posting URL first.")
            return

        self.scrape_btn.setEnabled(False)
        self.log_label.setText(f"Status: Fetching job posting from {url}...")

        self.scraper_thread = ScraperWorker(url)
        self.scraper_thread.finished_signal.connect(self.on_scrape_success)
        self.scraper_thread.error_signal.connect(self.on_scrape_error)
        self.scraper_thread.start()

    def on_scrape_success(self, data: Dict[str, Any]):
        self.scrape_btn.setEnabled(True)
        self.scraped_metadata = data
        self.jd_text.setPlainText(data.get("description", ""))
        title = data.get("title", "Position")
        company = data.get("company", "Company")
        self.log_label.setText(f"Status: Successfully loaded '{title}' at '{company}'. Ready to process.")

    def on_scrape_error(self, err_msg: str):
        self.scrape_btn.setEnabled(True)
        self.log_label.setText("Status: Scraping encountered an issue. You can paste the JD manually.")
        QMessageBox.information(self, "Notice", f"Could not automatically scrape page ({err_msg}). Please paste the job description text manually.")

    def start_pipeline(self):
        jd_content = self.jd_text.toPlainText().strip()
        if not jd_content or len(jd_content) < 50:
            QMessageBox.warning(self, "Empty Job Description", "Please enter or scrape a complete job description before processing.")
            return

        self.process_btn.setEnabled(False)
        self.progress_bar.show()
        self.progress_bar.setValue(5)
        self.log_label.setText("Status: Starting 3-Pass AI Pipeline...")

        self.worker = PipelineWorker(jd_content)
        self.worker.progress_signal.connect(self.on_progress_update)
        self.worker.finished_signal.connect(self.on_pipeline_success)
        self.worker.error_signal.connect(self.on_pipeline_error)
        self.worker.start()

    def on_progress_update(self, msg: str, percent: int):
        self.progress_bar.setValue(percent)
        self.log_label.setText(f"Status: {msg}")

    def on_pipeline_success(self, results: Dict[str, Any]):
        self.process_btn.setEnabled(True)
        self.progress_bar.setValue(100)
        self.log_label.setText("Status: Pipeline finished! Switching to Preview...")
        
        # Attach metadata to result
        results["job_metadata"] = {
            "url": self.url_input.text().strip(),
            "company": self.scraped_metadata.get("company") or results.get("job_analysis", {}).get("company", "Company"),
            "title": self.scraped_metadata.get("title") or results.get("job_analysis", {}).get("title", "Role"),
            "raw_jd": self.jd_text.toPlainText()
        }
        
        self.pipeline_completed.emit(results)

    def on_pipeline_error(self, err: str):
        self.process_btn.setEnabled(True)
        self.progress_bar.hide()
        self.log_label.setText("Status: Pipeline failed. Check API key and logs.")
        QMessageBox.critical(self, "Pipeline Error", f"Failed to execute AI pipeline:\n\n{err}")
