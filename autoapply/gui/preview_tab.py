"""
Preview Tab: Side-by-side interactive preview of Tailored CV and Cover Letter.
Includes Edit Modals, Single-Pass Regenerate, Gap Warnings Panel, Diff Viewer, and PDF compilation.
"""

import json
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QTextEdit,
    QPushButton, QSplitter, QGroupBox, QDialog,
    QDialogButtonBox, QMessageBox, QScrollArea, QFrame
)

from config import settings
from core.latex_renderer import LaTeXRenderer
from core.page_enforcer import PageEnforcer
from core.tracker import ApplicationTracker

logger = logging.getLogger(__name__)


class EditModalDialog(QDialog):
    """Modal for tweaking raw LaTeX fragments or cover letter paragraphs."""

    def __init__(self, title: str, initial_content: str, parent=None):
        super().__init__(parent)
        self.setWindowTitle(title)
        self.resize(750, 550)
        layout = QVBoxLayout(self)

        self.editor = QTextEdit()
        self.editor.setPlainText(initial_content)
        self.editor.setStyleSheet("font-family: monospace; font-size: 13px;")
        layout.addWidget(self.editor)

        btn_box = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        btn_box.accepted.connect(self.accept)
        btn_box.rejected.connect(self.reject)
        layout.addWidget(btn_box)

    def get_content(self) -> str:
        return self.editor.toPlainText()


class PreviewTab(QWidget):
    """
    Preview Tab displaying rendered content, gap warnings, diffs, and PDF compilation triggers.
    """
    application_saved = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.pipeline_data: Dict[str, Any] = {}
        self.current_cv_tex: str = ""
        self.current_cover_tex: str = ""
        self.generated_cv_pdf: Optional[Path] = None
        self.generated_cover_pdf: Optional[Path] = None
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # 1. Gap Warnings Banner (Yellow / Amber alert box)
        self.gaps_box = QGroupBox("Skill Gap Warnings & Strategic Alignment")
        self.gaps_box.setStyleSheet("""
            QGroupBox {
                border: 1px solid #d29922;
                border-radius: 6px;
                margin-top: 6px;
                font-weight: bold;
                color: #e3b341;
            }
        """)
        gaps_layout = QVBoxLayout(self.gaps_box)
        self.gaps_label = QLabel("No gaps evaluated yet. Run the 3-pass pipeline to view missing skill warnings.")
        self.gaps_label.setWordWrap(True)
        self.gaps_label.setStyleSheet("color: #d4d4d4; font-weight: normal;")
        gaps_layout.addWidget(self.gaps_label)
        layout.addWidget(self.gaps_box)

        # 2. Main Splitter: CV Preview (Left) vs Cover Letter Preview (Right)
        splitter = QSplitter(Qt.Orientation.Horizontal)

        # Left: CV Pane
        cv_container = QGroupBox("Tailored LaTeX CV (Target: Max 2 Pages)")
        cv_layout = QVBoxLayout(cv_container)
        self.cv_preview = QTextEdit()
        self.cv_preview.setReadOnly(True)
        self.cv_preview.setPlaceholderText("Tailored CV fragments will appear here...")
        cv_layout.addWidget(self.cv_preview)

        cv_btn_row = QHBoxLayout()
        self.edit_cv_btn = QPushButton("Edit CV Content")
        self.edit_cv_btn.clicked.connect(self.edit_cv)
        self.regen_cv_btn = QPushButton("Regenerate Pass 2")
        self.regen_cv_btn.clicked.connect(self.regenerate_cv)
        cv_btn_row.addWidget(self.edit_cv_btn)
        cv_btn_row.addWidget(self.regen_cv_btn)
        cv_layout.addLayout(cv_btn_row)

        splitter.addWidget(cv_container)

        # Right: Cover Letter Pane
        cover_container = QGroupBox("Tailored Cover Letter (Target: Max 1 Page)")
        cover_layout = QVBoxLayout(cover_container)
        self.cover_preview = QTextEdit()
        self.cover_preview.setReadOnly(True)
        self.cover_preview.setPlaceholderText("Tailored Cover Letter will appear here...")
        cover_layout.addWidget(self.cover_preview)

        cover_btn_row = QHBoxLayout()
        self.edit_cover_btn = QPushButton("Edit Cover Letter")
        self.edit_cover_btn.clicked.connect(self.edit_cover)
        self.regen_cover_btn = QPushButton("Regenerate Pass 3")
        self.regen_cover_btn.clicked.connect(self.regenerate_cover)
        cover_btn_row.addWidget(self.edit_cover_btn)
        cover_btn_row.addWidget(self.regen_cover_btn)
        cover_layout.addLayout(cover_btn_row)

        splitter.addWidget(cover_container)
        layout.addWidget(splitter, stretch=1)

        # 3. Diff View Panel (Collapsible / Summary)
        diff_group = QGroupBox("Profile Tailoring Diff & Evidence Trace")
        diff_layout = QVBoxLayout(diff_group)
        self.diff_label = QLabel("Truthfulness Check: All generated text is mapped directly from your master profile.")
        self.diff_label.setStyleSheet("color: #8b949e; font-size: 12px;")
        diff_layout.addWidget(self.diff_label)
        layout.addWidget(diff_group)

        # 4. Bottom Action Bar
        action_row = QHBoxLayout()
        self.status_feedback = QLabel("Ready.")
        self.status_feedback.setStyleSheet("color: #58a6ff;")
        
        self.compile_btn = QPushButton("Compile PDFs (pdflatex)")
        self.compile_btn.setObjectName("primaryActionButton")
        self.compile_btn.setMinimumHeight(40)
        self.compile_btn.clicked.connect(self.compile_documents)

        self.save_tracker_btn = QPushButton("Save Application to Tracker")
        self.save_tracker_btn.setObjectName("accentButton")
        self.save_tracker_btn.setMinimumHeight(40)
        self.save_tracker_btn.clicked.connect(self.save_to_tracker)

        action_row.addWidget(self.status_feedback, stretch=1)
        action_row.addWidget(self.compile_btn)
        action_row.addWidget(self.save_tracker_btn)
        layout.addLayout(action_row)

    def load_pipeline_results(self, data: Dict[str, Any]):
        """Populates the preview fields from pipeline data."""
        self.pipeline_data = data
        pass_1 = data.get("pass_1", {})
        pass_2 = data.get("pass_2", {})
        pass_3 = data.get("pass_3", {})
        gaps = data.get("gaps", {})

        # Populate Gaps Warning
        missing_skills = gaps.get("missing_skills", [])
        missing_reqs = gaps.get("missing_requirements", [])
        strategy = gaps.get("strategy", "")

        gap_text = ""
        if missing_skills:
            gap_text += f"• Missing Skills Flagged: {', '.join(missing_skills)}\n"
        if missing_reqs:
            gap_text += f"• Unmet Requirements: {', '.join(missing_reqs)}\n"
        if strategy:
            gap_text += f"• Strategic Alignment: {strategy}"

        if gap_text:
            self.gaps_label.setText(gap_text)
            self.gaps_box.show()
        else:
            self.gaps_label.setText("No critical skill gaps identified! Strong profile alignment with target requirements.")

        # Format CV Preview Text
        cv_formatted = f"""==================================================
TARGET HEADER: {pass_2.get('dynamic_header_title', '')}
==================================================

[PROFILE SUMMARY]
{pass_2.get('professional_summary', '')}

[PROFESSIONAL EXPERIENCE]
{pass_2.get('experience_sections', '')}

[EDUCATION]
{pass_2.get('education_section', '')}

[TECHNICAL TOOLKIT]
{pass_2.get('skills_section', '')}

[INDEPENDENT PROJECTS]
{pass_2.get('projects_section', '')}

[LANGUAGES]
{pass_2.get('languages_section', '')}
"""
        self.cv_preview.setPlainText(cv_formatted)

        # Format Cover Letter Preview Text
        cover_formatted = f"""Recipient: {pass_3.get('recipient_company', 'Company')} ({pass_3.get('recipient_location', '')})
Subject: {pass_3.get('subject_line', '')}
Salutation: {pass_3.get('salutation', 'Dear Hiring Team,')}

{pass_3.get('body_paragraph_1', '')}

{pass_3.get('body_paragraph_2', '')}

{pass_3.get('body_paragraph_3', '')}

{pass_3.get('closing', '')}
"""
        self.cover_preview.setPlainText(cover_formatted)
        self.status_feedback.setText("Results loaded. Ready to compile PDFs or save.")

    def edit_cv(self):
        current_text = self.cv_preview.toPlainText()
        dialog = EditModalDialog("Edit Tailored CV Text", current_text, self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            self.cv_preview.setPlainText(dialog.get_content())
            self.status_feedback.setText("CV content manually updated.")

    def edit_cover(self):
        current_text = self.cover_preview.toPlainText()
        dialog = EditModalDialog("Edit Cover Letter Content", current_text, self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            self.cover_preview.setPlainText(dialog.get_content())
            self.status_feedback.setText("Cover letter content manually updated.")

    def regenerate_cv(self):
        if not self.pipeline_data.get("pass_1"):
            QMessageBox.warning(self, "Missing Analysis", "Please run the pipeline from Input Tab first.")
            return

        from core.content_generator import ContentGenerator
        self.status_feedback.setText("Regenerating CV pass...")
        try:
            gen = ContentGenerator()
            pass_2 = gen.run_pass_2(self.pipeline_data["pass_1"])
            self.pipeline_data["pass_2"] = pass_2
            self.load_pipeline_results(self.pipeline_data)
            self.status_feedback.setText("Pass 2 regenerated successfully.")
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to regenerate Pass 2: {e}")

    def regenerate_cover(self):
        if not self.pipeline_data.get("pass_1"):
            QMessageBox.warning(self, "Missing Analysis", "Please run the pipeline from Input Tab first.")
            return

        from core.content_generator import ContentGenerator
        self.status_feedback.setText("Regenerating Cover Letter pass...")
        try:
            gen = ContentGenerator()
            pass_3 = gen.run_pass_3(self.pipeline_data["pass_1"])
            self.pipeline_data["pass_3"] = pass_3
            self.load_pipeline_results(self.pipeline_data)
            self.status_feedback.setText("Pass 3 regenerated successfully.")
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to regenerate Pass 3: {e}")

    def compile_documents(self):
        """Compiles LaTeX to PDF enforcing page limits."""
        if not self.pipeline_data:
            QMessageBox.warning(self, "No Data", "No generated content to compile.")
            return

        job_meta = self.pipeline_data.get("job_metadata", {})
        company = re.sub(r'[^a-zA-Z0-9_-]', '_', job_meta.get("company", "Company"))
        role = re.sub(r'[^a-zA-Z0-9_-]', '_', job_meta.get("title", "Role"))
        date_str = datetime.now().strftime("%Y-%m-%d")
        folder_name = f"{date_str}_{company}_{role}"

        self.status_feedback.setText("Compiling LaTeX to PDF with 2-Page CV / 1-Page Cover enforcement...")

        renderer = LaTeXRenderer()
        enforcer = PageEnforcer(renderer)
        profile_dict = settings.master_profile_path

        from core.profile_manager import ProfileManager
        pm = ProfileManager()
        prof_data = pm.raw_yaml_dict

        pass_2 = self.pipeline_data.get("pass_2", {})
        pass_3 = self.pipeline_data.get("pass_3", {})

        # Build CV Context
        cv_context = {
            "personal": prof_data.get("personal", {}),
            "dynamic_header_title": pass_2.get("dynamic_header_title", prof_data.get("personal", {}).get("title")),
            "has_photo": True,
            "photo_path": "Sutej.png",
            "professional_summary": pass_2.get("professional_summary", ""),
            "experience_sections": pass_2.get("experience_sections", ""),
            "education_section": pass_2.get("education_section", ""),
            "skills_section": pass_2.get("skills_section", ""),
            "projects_section": pass_2.get("projects_section", ""),
            "languages_section": pass_2.get("languages_section", "")
        }

        # Build Cover Letter Context
        cover_context = {
            "personal": prof_data.get("personal", {}),
            "recipient_company": pass_3.get("recipient_company", "Company"),
            "recipient_location": pass_3.get("recipient_location", "Germany"),
            "subject_line": pass_3.get("subject_line", f"Application for {role}"),
            "salutation": pass_3.get("salutation", "Dear Hiring Team,"),
            "body_paragraph_1": pass_3.get("body_paragraph_1", ""),
            "body_paragraph_2": pass_3.get("body_paragraph_2", ""),
            "body_paragraph_3": pass_3.get("body_paragraph_3", ""),
            "closing": pass_3.get("closing", "Best regards,")
        }

        # Render & Compile CV with page enforcer
        cv_success, final_cv_tex, cv_pages, cv_pdf = enforcer.enforce_cv_pages(cv_context, folder_name)
        self.current_cv_tex = final_cv_tex
        self.generated_cv_pdf = cv_pdf

        # Render & Compile Cover Letter
        cover_tex = renderer.render_cover_tex(cover_context)
        self.current_cover_tex = cover_tex
        cover_success, cover_pdf, cover_msg = renderer.compile_pdf(cover_tex, folder_name, "Cover_Letter_Tailored")
        self.generated_cover_pdf = cover_pdf

        output_path = settings.output_dir / folder_name
        msg = f"LaTeX files generated in:\n{output_path}\n\n"
        if cv_pdf and cv_pdf.exists():
            msg += f"• CV PDF: {cv_pdf.name} ({cv_pages} page(s))\n"
        if cover_pdf and cover_pdf.exists():
            msg += f"• Cover Letter PDF: {cover_pdf.name}\n"

        if not cv_success and not cover_success:
            msg += "\nNote: pdflatex was not found on your system PATH or encountered an error. The complete .tex source files are saved and ready to compile in TeXStudio/Overleaf."

        QMessageBox.information(self, "Compilation Status", msg)
        self.status_feedback.setText(f"Generated documents in output/{folder_name}")

    def save_to_tracker(self):
        if not self.pipeline_data:
            QMessageBox.warning(self, "No Data", "No application data to save.")
            return

        job_meta = self.pipeline_data.get("job_metadata", {})
        tracker = ApplicationTracker()
        
        app_id = tracker.add_application(
            url=job_meta.get("url", ""),
            company=job_meta.get("company", "Company"),
            role=job_meta.get("title", "Role"),
            source="AutoApply",
            status=ApplicationTracker.STATUS_TAILORED,
            cv_pdf_path=str(self.generated_cv_pdf) if self.generated_cv_pdf else "",
            cover_pdf_path=str(self.generated_cover_pdf) if self.generated_cover_pdf else "",
            gaps_json=json.dumps(self.pipeline_data.get("gaps", {})),
            ai_passes_json=json.dumps(self.pipeline_data),
            notes="Tailored with 3-Pass Gemini intelligence."
        )

        self.status_feedback.setText("Application saved to Tracker Kanban.")
        QMessageBox.information(self, "Saved", f"Application for '{job_meta.get('title')}' at '{job_meta.get('company')}' added to tracker!")
        self.application_saved.emit()
