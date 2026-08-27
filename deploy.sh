#!/usr/bin/env bash
# ==============================================================================
# AutoApply - Homelab Single-Run Automated Deployment Script
# Target: Fedora Linux / RHEL / Debian / Ubuntu / Any Docker-enabled OS
# ==============================================================================

set -e

APP_NAME="autoapply"
CONTAINER_PORT="${PORT:-8000}"
DATA_DIR="./autoapply_data"

echo "======================================================================"
echo "🚀 AutoApply: Multi-User LaTeX Job Tailoring & Universal AI Assistant"
echo "======================================================================"

# 1. Check Root / Sudo or User Permissions
if ! command -v docker &> /dev/null; then
    echo "⚠️ Docker is not installed. Installing or please install docker first."
    if command -v dnf &> /dev/null; then
        echo "📦 Detected Fedora/RHEL. Installing docker..."
        sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin || sudo dnf install -y docker docker-compose
        sudo systemctl enable --now docker
        sudo usermod -aG docker "$USER" || true
    elif command -v apt-get &> /dev/null; then
        echo "📦 Detected Debian/Ubuntu. Installing docker..."
        sudo apt-get update && sudo apt-get install -y docker.io docker-compose
        sudo systemctl enable --now docker
        sudo usermod -aG docker "$USER" || true
    else
        echo "❌ Error: Docker is required. Please install Docker and re-run this script."
        exit 1
    fi
fi

# 2. Check Tailscale and Fedora Firewall (Firewalld)
if command -v firewall-cmd &> /dev/null && systemctl is-active --quiet firewalld; then
    echo "🛡️ Configuring Fedora Firewall (firewalld)..."
    echo "➡️ Allowing port ${CONTAINER_PORT}/tcp..."
    sudo firewall-cmd --add-port="${CONTAINER_PORT}/tcp" --permanent || true
    
    # If Tailscale interface exists, trust tailscale0
    if ip link show tailscale0 &> /dev/null; then
        echo "🔒 Whitelisting tailscale0 network interface into trusted zone..."
        sudo firewall-cmd --zone=trusted --add-interface=tailscale0 --permanent || true
    fi
    sudo firewall-cmd --reload || true
fi

# 3. Create persistent host directory
mkdir -p "${DATA_DIR}"
mkdir -p "${DATA_DIR}/users"
mkdir -p "${DATA_DIR}/assets"

# Seed default profile if exists
if [ -f "autoapply/assets/master_profile.yaml" ] && [ ! -f "${DATA_DIR}/assets/master_profile.yaml" ]; then
    cp "autoapply/assets/master_profile.yaml" "${DATA_DIR}/assets/master_profile.yaml"
fi

# 4. Generate Dockerfile with TeX Live LaTeX Compiler
cat << 'EOF' > Dockerfile
FROM node:22-slim

# Install TeX Live and pdflatex dependencies for zero-friction LaTeX compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-lang-german \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package descriptors
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Build Vite frontend & CommonJS server bundle
RUN npm run build

# Volume for user databases, settings, and generated documents
VOLUME ["/app/autoapply"]

ENV PORT=3000
ENV NODE_ENV=production
ENV DATA_DIR=/app/autoapply

EXPOSE 3000

CMD ["npm", "start"]
EOF

# 5. Generate Docker Compose Manifest
cat << EOF > docker-compose.yml
services:
  autoapply:
    build: .
    container_name: ${APP_NAME}
    restart: unless-stopped
    ports:
      - "${CONTAINER_PORT}:3000"
    environment:
      - PORT=3000
      - NODE_ENV=production
      - DATA_DIR=/app/autoapply
      - ADMIN_USERNAME=\${ADMIN_USERNAME:-admin}
      - ADMIN_PASSWORD=\${ADMIN_PASSWORD:-adminpassword123}
      - GEMINI_API_KEY=\${GEMINI_API_KEY:-}
      - NVIDIA_API_KEY=\${NVIDIA_API_KEY:-}
      - GROQ_API_KEY=\${GROQ_API_KEY:-}
    volumes:
      - ${DATA_DIR}:/app/autoapply
EOF

# 6. Build and start container
echo "🔨 Building and starting AutoApply container on port ${CONTAINER_PORT}..."
if docker compose version &> /dev/null; then
    docker compose down || true
    docker compose up -d --build
else
    docker-compose down || true
    docker-compose up -d --build
fi

# 7. Print Access Info
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
TAILSCALE_IP=$(ip -4 addr show tailscale0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' || echo "")

echo ""
echo "======================================================================"
echo "🎉 AutoApply Homelab is RUNNING!"
echo "======================================================================"
echo "📍 Local Web Access:     http://localhost:${CONTAINER_PORT}"
echo "📍 LAN Web Access:       http://${LOCAL_IP}:${CONTAINER_PORT}"
if [ -n "${TAILSCALE_IP}" ]; then
    echo "🔒 Tailscale Access:     http://${TAILSCALE_IP}:${CONTAINER_PORT}"
fi
echo ""
echo "👤 Default Superadmin Credentials:"
echo "   Username: admin"
echo "   Password: adminpassword123"
echo "   (You can change your password immediately in Settings ⚙️)"
echo ""
echo "🔑 Disaster Recovery (Admin Password Reset):"
echo "   docker exec -it ${APP_NAME} node scripts/reset-admin.js --username admin --password <new-password>"
echo "======================================================================"
