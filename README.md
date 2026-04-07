# FastVid - Video Editor & Converter

A modern web-based video editor and converter supporting direct downloads from YouTube, Facebook, TikTok, and more.

## Features

- **Multi-platform import**: YouTube, Facebook, TikTok, direct video URLs
- **Video trimming/cutting**: Precise trim with timeline visualization
- **Video adjustments**: Brightness, contrast, saturation controls
- **Audio extraction**: Extract MP3 from videos
- **File upload**: Direct video file upload
- **Real-time preview**: Live video playback with controls

## Tech Stack

### Frontend
- **React 19** + Vite
- **Tailwind CSS** for styling
- **React Range** for timeline slider

### Backend
- **Node.js** + Express 5
- **FFmpeg** for video processing
- **yt-dlp** for media extraction from platforms
- **Multer** for file uploads
- **CORS** enabled for cross-origin requests

## Installation

### Prerequisites
- Node.js 18+
- yt-dlp (Windows binary included in `/server/`)
- FFmpeg (auto-installed via ffmpeg-static)

### Setup

1. **Clone repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/fastvid.git
   cd fastvid
   ```

2. **Install client dependencies**
   ```bash
   cd client
   npm install
   ```

3. **Install server dependencies**
   ```bash
   cd ../server
   npm install
   ```

## Development

### Start the backend server
```bash
cd server
npm start
# Server runs on http://localhost:5000
```

### Start the frontend dev server
```bash
cd client
npm run dev
# Client runs on http://localhost:5173
```

## Build for Production

### Build client
```bash
cd client
npm run build
# Output in ./dist
```

## Deployment

### Option 1: Vercel (Client) + Railway (Server)
- Deploy client to [Vercel](https://vercel.com)
- Deploy server to [Railway](https://railway.app)
- Update `API_BASE` in `src/App.jsx` to production server URL

### Option 2: Single Provider (DigitalOcean, Render, etc.)
- Use Docker/container to run both client and server
- Configure reverse proxy (nginx) to route `/api/*` to server

## Environment Variables

### Server (.env)
```
PORT=5000
NODE_ENV=production
```

## API Endpoints

- `POST /api/upload` - Upload video file
- `POST /api/import-url` - Import from direct URL
- `POST /api/import-media` - Import from platform (YouTube, TikTok, etc.)
- `POST /api/cut-video` - Trim and adjust video
- `POST /api/extract-audio` - Extract audio as MP3

## License

MIT

## Author

sommai123
