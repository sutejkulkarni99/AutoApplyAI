"""
AutoApply — Python GUI Job Application Assistant
Entry point script with automatic dependency validation.
"""

import logging
import os
import subprocess
import sys
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))


def check_and_prompt_dependencies():
    """Verify required packages before loading PyQt6 and core modules."""
    required_packages = [
        ("PyQt6", "PyQt6"),
        ("pydantic", "pydantic"),
        ("pydantic_settings", "pydantic-settings"),
        ("yaml", "pyyaml"),
        ("jinja2", "jinja2"),
        ("google.genai", "google-genai"),
        ("pypdf", "pypdf"),
        ("dotenv", "python-dotenv"),
        ("requests", "requests"),
        ("bs4", "beautifulsoup4"),
    ]

    missing = []
    for module_name, pip_name in required_packages:
        try:
            __import__(module_name)
        except ImportError:
            missing.append(pip_name)

    if missing:
        print("\n" + "=" * 70)
        print("  AutoApply — Missing Required Python Packages")
        print("=" * 70)
        print("\nThe following packages are not yet installed in your Python environment:\n")
        for pkg in missing:
            print(f"   [x] {pkg}")
        
        req_file = BASE_DIR / "requirements.txt"
        print(f"\nInstall command:")
        print(f"   {sys.executable} -m pip install -r \"{req_file}\"\n")
        print("=" * 70)

        # Interactive auto-install attempt
        try:
            user_input = input("\nWould you like AutoApply to install these packages automatically now? (Y/n): ").strip().lower()
            if user_input in ("", "y", "yes"):
                print("\n[AutoApply] Installing required packages via pip. Please wait...")
                if req_file.exists():
                    res = subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(req_file)])
                else:
                    res = subprocess.run([sys.executable, "-m", "pip", "install"] + missing)
                
                if res.returncode == 0:
                    print("\n[AutoApply] ✓ All dependencies installed successfully! Launching AutoApply GUI...\n")
                    os.execv(sys.executable, [sys.executable] + sys.argv)
                else:
                    print("\n[AutoApply] ✗ Installation encountered an error. Please run the install command manually above.")
                    sys.exit(1)
            else:
                print("\nPlease install the dependencies manually and re-run main.py.")
                sys.exit(1)
        except KeyboardInterrupt:
            print("\nOperation cancelled.")
            sys.exit(1)
        except Exception as e:
            print(f"\nPlease run the installation command manually:\n  {sys.executable} -m pip install -r requirements.txt")
            sys.exit(1)


# Perform preflight check before importing heavy GUI / settings modules
check_and_prompt_dependencies()

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import QApplication, QMessageBox
from config import settings
from core.tracker import ApplicationTracker
from gui.main_window import MainWindow

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("autoapply")


def main():
    # Enable High DPI scaling for modern displays
    if hasattr(Qt.ApplicationAttribute, "AA_EnableHighDpiScaling"):
        QApplication.setAttribute(Qt.ApplicationAttribute.AA_EnableHighDpiScaling, True)
    if hasattr(Qt.ApplicationAttribute, "AA_UseHighDpiPixmaps"):
        QApplication.setAttribute(Qt.ApplicationAttribute.AA_UseHighDpiPixmaps, True)

    app = QApplication(sys.argv)
    app.setApplicationName("AutoApply")
    app.setOrganizationName("AutoApply")

    # Initialize SQLite database
    try:
        ApplicationTracker()
        logger.info("Database initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

    # Check for API key warning
    if not settings.google_ai_studio_api_key:
        logger.warning("GOOGLE_AI_STUDIO_API_KEY environment variable is not set.")

    window = MainWindow()
    window.show()

    # Inform user if API key is missing on launch
    if not settings.google_ai_studio_api_key:
        QMessageBox.warning(
            window,
            "API Key Notice",
            "GOOGLE_AI_STUDIO_API_KEY is not set.\n\n"
            "You can set it via Settings > API & Compiler Settings or via environment variables before running the 3-pass AI pipeline."
        )

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
