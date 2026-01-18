# Backend Proxy Server Setup Guide

## Quick Start

### Step 1: Install Dependencies

Open your terminal in the project root and run:

```bash
npm install
```

This will install:
- `express` - Web server
- `cors` - CORS middleware  
- `dotenv` - Environment variable loader
- `concurrently` - Run multiple commands (optional)

### Step 2: Verify Your .env.local File

Make sure your `.env.local` file in the project root has:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

Optional settings:
```env
PROXY_PORT=3001  # Port for the proxy server (default: 3001)
FRONTEND_URL=http://localhost:3000  # Your frontend URL (default: http://localhost:3000)
VITE_PROXY_URL=http://localhost:3001  # Proxy URL for frontend (optional)
```

### Step 3: Start the Backend Server

**Option A: Run server only (recommended for first test)**
```bash
npm run server
```

You should see:
```
🚀 Anthropic Proxy Server running on http://localhost:3001
📡 Proxying requests to Anthropic API
🔑 API Key: ✓ Loaded
```

**Option B: Run both frontend and backend together**
```bash
npm run dev:all
```

This starts both servers at once.

**Option C: Run in separate terminals (recommended for development)**
- Terminal 1: `npm run server` (backend)
- Terminal 2: `npm run dev` (frontend)

### Step 4: Test It

1. Open your app in the browser (http://localhost:3000)
2. Go to the API Key Tester
3. Click "Test All APIs"
4. Claude should now work! ✅

## What Changed?

### Before (CORS Error)
- Frontend → ❌ Anthropic API (blocked by CORS)

### After (Working!)
- Frontend → ✅ Backend Proxy → ✅ Anthropic API

## File Structure

```
your-project/
├── server/
│   ├── index.js          # Backend proxy server
│   └── README.md         # Detailed server documentation
├── services/
│   └── claudeService.ts  # Updated to use proxy
├── package.json          # Added server scripts and dependencies
└── .env.local            # Your API keys (not committed to git)
```

## Troubleshooting

### Problem: "Cannot connect to proxy server"

**Solution:**
1. Make sure the server is running: `npm run server`
2. Check the console for errors
3. Verify port 3001 is not already in use

### Problem: "ANTHROPIC_API_KEY is not set on the server"

**Solution:**
1. Check that `.env.local` exists in the project root
2. Verify `ANTHROPIC_API_KEY=your_key` is in the file
3. Restart the server after adding the key

### Problem: Still getting CORS errors

**Solution:**
1. Make sure the backend server is running
2. Check browser console for the actual error
3. Verify the proxy URL matches (default: http://localhost:3001)

## How It Works

1. **Your frontend** calls `http://localhost:3001/api/claude/chat`
2. **Backend server** receives the request
3. **Backend** forwards it to Anthropic with your API key
4. **Anthropic** processes and responds
5. **Backend** sends the response back to your frontend

**Key Benefit:** Your API key stays on the server and is never exposed to the browser!

## Next Steps

Once it's working:
- ✅ Claude API calls will work from your browser
- ✅ No more CORS errors
- ✅ API key is secure on the server
- ✅ You can use all Claude features in your app

For more details, see `server/README.md`
