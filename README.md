# AutoApply Homelab: Multi-User LaTeX Job Tailoring & Universal AI Assistant

AutoApply is a self-hosted, multi-user job application tailoring platform designed for homelabs (Fedora Linux, Docker, Tailscale). It enforces zero-hallucination grounding against candidate master YAML profiles, guarantees strict length constraints (2-page maximum for CVs and 1-page for Cover Letters), and compiles directly to native LaTeX `.tex` and `.pdf` files.

---

## 🌟 Key Features

1. **Multi-User Authentication & Role-Based Access Control (RBAC)**:
   - Superadmin and standard user tiers.
   - Admin user management console (`👑`) to create new accounts, assign roles, and reset user credentials.
   - Complete tenant isolation: each user has private settings, YAML master profile, and application history stored in `/app/autoapply/users/<userId>/`.

2. **Universal AI Provider Engine**:
   - **Google Gemini**: Native SDK support for `gemini-3.6-flash` (recommended), `gemini-3.7-flash`, `gemini-2.0-flash`, `gemini-1.5-pro`.
   - **NVIDIA NIM Open APIs**: Free high-performance cloud endpoints (`nvidia/nemotron-4-340b-instruct`, `meta/llama-3.3-70b-instruct`, `deepseek-ai/deepseek-r1`, `mistralai/mixtral-8x22b-instruct`).
   - **Groq Cloud**: High-speed inference (`llama-3.3-70b-versatile`, `mixtral-8x7b-32768`).
   - **Local Ollama**: Self-hosted local LLMs running on your Fedora machine (`http://localhost:11434/v1`).
   - **Custom OpenAI-Compatible Endpoints**: Connect any custom model ID and base URL.

3. **Grounded LaTeX & PDF Compilation**:
   - Compiles server-side with native `pdflatex` via TeX Live.
   - One-click exports for `.pdf`, `.tex`, and dual-package `.tex + .pdf`.
   - Honest ATS match percentage and missing-skill gap analysis.

4. **Candidate YAML Profile Manager**:
   - Drag-and-drop `.yaml` file uploader with instant schema validation and visual overview cards.
   - In-place YAML code editor.

5. **Confidentiality by Design**:
   - Source code and project files are strictly protected—no code downloads or codebase inspection endpoints.
   - Users can only export their own compiled PDFs, LaTeX files, and tailored outputs.

---

## 🚀 One-Command Fedora / Linux Deployment (`deploy.sh`)

To deploy and start AutoApply in detached mode on Fedora KDE or any Linux machine with Docker:

```bash
# 1. Clone or navigate to the repository directory
cd /path/to/autoapply

# 2. Make deploy.sh executable and run
chmod +x deploy.sh
./deploy.sh
```

### Custom Port Configuration
By default, AutoApply runs on port **8000**. To specify a different port:
```bash
PORT=9000 ./deploy.sh
```

### What `deploy.sh` Does Automatically:
- Checks Docker & Docker Compose installation (installs on Fedora/RHEL if missing).
- Automatically configures Fedora's `firewalld` to allow your port and whitelists `tailscale0` into the trusted zone.
- Builds a Docker image containing Node.js 22 and TeX Live (`pdflatex`).
- Starts the container with persistent volume mounts at `./autoapply_data`.
- Displays local, LAN, and Tailscale access URLs.

---

## 🔑 Default Superadmin Credentials

On first launch, AutoApply automatically bootstraps an initial superadmin:
- **Username**: `admin`
- **Password**: `adminpassword123`

> **Important**: Log in and immediately change your password in the **Settings (`⚙️`)** or **Account** panel.

---

## 🛠️ Disaster Recovery: Resetting the Administrator Password

If the admin password is forgotten, you can reset it directly from the Fedora host terminal without needing email services or external tools:

### Method 1: Direct Docker CLI Command
```bash
docker exec -it autoapply node scripts/reset-admin.js --username admin --password "YourNewStrongPassword123"
```

### Method 2: Standalone Host Command (Outside Docker)
```bash
DATA_DIR="./autoapply_data" node scripts/reset-admin.js --username admin --password "YourNewStrongPassword123"
```

### Method 3: Environment Variable Reset
Add the following line to your `.env` file or `docker-compose.yml`:
```env
ADMIN_RESET_PASSWORD="YourNewStrongPassword123"
```
Then restart the container:
```bash
docker compose restart
```
On boot, AutoApply will update the admin password hash and log confirmation to stdout.

---

## 👤 User Administration & Management

1. Log in with an account having the **Admin** role.
2. Click the **Admin Shield (`👑`)** in the top navigation bar.
3. Use the console to:
   - **Create New Users**: Specify username, temporary password, and role (`Standard User` or `Administrator`).
   - **Reset Password**: Click the Key icon on any user row to set a new password.
   - **Delete User**: Removes the user and permanently purges their isolated data directory.

---

## 🧠 Setting Up AI Providers & API Keys

Navigate to **Settings (`⚙️`)**:

1. **Google Gemini**:
   - Select **Google Gemini**.
   - Enter your Google AI Studio API key.
   - Click **Test Connection Latency** to verify.

2. **NVIDIA NIM Open APIs**:
   - Select **NVIDIA NIM**.
   - Set Model (e.g. `nvidia/nemotron-4-340b-instruct`).
   - Base URL defaults to: `https://integrate.api.nvidia.com/v1`.
   - Enter your NVIDIA API key (`nvapi-...`).
   - Click **Test Connection Latency**.

3. **Groq Cloud / Ollama / Custom**:
   - Select the respective provider tab, specify your model ID, and enter your key or local port (e.g. `http://localhost:11434/v1`).

---

## 📁 Data Storage & Directory Layout

All application data is isolated inside `./autoapply_data`:

```text
autoapply_data/
├── users.json                   # User accounts & cryptographic password hashes
├── assets/                      # Default profile templates
└── users/                       # Tenant-isolated directories
    ├── usr_admin_root/
    │   ├── settings.json        # Admin's private API keys & selected model
    │   ├── master_profile.yaml  # Admin's ground-truth profile
    │   └── tracker_data.json    # Admin's Kanban board records
    └── usr_user2_xyz/
        ├── settings.json
        ├── master_profile.yaml
        └── tracker_data.json
```
