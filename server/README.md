# Backend Proxy Server

This server proxies requests from the frontend to Anthropic's Claude API to bypass CORS restrictions.

## Setup Instructions

### 1. Install Dependencies

First, install the new dependencies:

```bash
npm install
```

This will install:
- `express` - Web server framework
- `cors` - CORS middleware
- `dotenv` - Environment variable loader
- `concurrently` - Run multiple commands (optional, for dev:all script)

### 2. Configure Environment Variables

Make sure your `.env.local` file includes:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
PROXY_PORT=3001  # Optional, defaults to 3001
FRONTEND_URL=http://localhost:3000  # Optional, defaults to http://localhost:3000
```

### 3. Run the Server

You have several options:

**Option A: Run server only**
```bash
npm run server
```

**Option B: Run both frontend and backend together**
```bash
npm run dev:all
```

**Option C: Run in separate terminals**
- Terminal 1: `npm run server` (backend on port 3001)
- Terminal 2: `npm run dev` (frontend on port 3000)

### 4. Verify It's Working

1. Check the server console - you should see:
   ```
   🚀 Anthropic Proxy Server running on http://localhost:3001
   📡 Proxying requests to Anthropic API
   🔑 API Key: ✓ Loaded
   ```

2. Test the health endpoint:
   ```bash
   curl http://localhost:3001/health
   ```
   Should return: `{"status":"ok","service":"anthropic-proxy"}`

3. Test in your app - the API Key Tester should now work for Claude!

## How It Works

1. **Frontend** makes a request to `http://localhost:3001/api/claude/chat`
2. **Backend** receives the request and forwards it to Anthropic's API
3. **Anthropic** processes the request and returns a response
4. **Backend** forwards the response back to the frontend

The API key stays secure on the server and is never exposed to the browser.

## Troubleshooting

### "Cannot connect to proxy server"
- Make sure the server is running: `npm run server`
- Check that port 3001 is not already in use
- Verify the proxy URL in your frontend matches the server port

### "ANTHROPIC_API_KEY is not set on the server"
- Make sure `.env.local` exists in the project root
- Verify `ANTHROPIC_API_KEY` is set in `.env.local`
- Restart the server after adding/changing environment variables

### CORS errors still appearing
- Make sure the backend server is running
- Check that `VITE_USE_CLAUDE_PROXY` is not set to `false` in your `.env.local`
- Verify the frontend is calling the proxy URL, not Anthropic directly

## Configuration

You can customize the proxy behavior with environment variables:

- `PROXY_PORT` - Port for the proxy server (default: 3001)
- `FRONTEND_URL` - Allowed origin for CORS (default: http://localhost:3000)
- `ANTHROPIC_API_KEY` - Your Anthropic API key (required)

## Security Notes

- The API key is stored server-side only
- CORS is configured to only allow requests from your frontend URL
- Never commit `.env.local` to version control
- In production, use environment variables on your hosting platform
