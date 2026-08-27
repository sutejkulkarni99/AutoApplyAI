# AutoApply - Homelab Container
# Isolated Docker Container with TeX Live LaTeX Compiler & Gemini AI Engine

FROM node:22-bookworm-slim AS base

# Install TeX Live packages for headless LaTeX to PDF compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    latexmk \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Build React client and TypeScript backend server
RUN npm run build

# Prepare persistent data directory
RUN mkdir -p /app/data && cp -r /app/autoapply/assets /app/data/ 2>/dev/null || true

# Environment variables
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000

EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the full-stack server
CMD ["node", "dist/server.cjs"]
