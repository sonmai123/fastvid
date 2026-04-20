FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
  ffmpeg \
  python3 \
  curl \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp

COPY package*.json ./
COPY prisma ./prisma
RUN npm install
RUN npm prune --production

COPY . ./

EXPOSE 5000
CMD ["node", "index.js"]
