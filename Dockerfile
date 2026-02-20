FROM node:20-slim

# Install Chromium and fonts
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
    libgbm1 libasound2t64 libxrandr2 libxcomposite1 \
    libxdamage1 libxfixes3 libpango-1.0-0 libcairo2 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

CMD ["node", "src/server.js"]
