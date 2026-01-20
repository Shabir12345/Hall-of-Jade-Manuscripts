# Pinecone MCP Setup Guide

This guide will help you set up Pinecone MCP (Model Context Protocol) for automated vector database management in Cursor IDE.

## Prerequisites

1. Pinecone account and API key (you already have this!)
2. Node.js installed on your system
3. Cursor IDE

## Step 1: Create MCP Configuration

Add the following to your Cursor MCP configuration file.

**Location:** Create or edit `.cursor/mcp.json` in your project root or `%APPDATA%\Cursor\mcp.json` for global config.

```json
{
  "mcpServers": {
    "pinecone": {
      "command": "npx",
      "args": [
        "-y",
        "@pinecone-database/mcp"
      ],
      "env": {
        "PINECONE_API_KEY": "YOUR_PINECONE_API_KEY_HERE"
      }
    }
  }
}
```

**Replace `YOUR_PINECONE_API_KEY_HERE` with your actual Pinecone API key.**

## Step 2: Create Rules File (Optional but Recommended)

Create `.cursor/rules/pinecone.mdc` to guide the AI on when to use Pinecone tools:

```markdown
### Pinecone MCP Tool Usage

- When generating code related to Pinecone, always use the `pinecone` MCP and the `search_docs` tool.
- Perform at least two distinct searches per request using different, relevant questions to ensure comprehensive context.

### Error Handling

- If an error occurs while executing Pinecone-related code, immediately invoke the `pinecone` MCP and the `search_docs` tool.

### Available Tools

The Pinecone MCP provides these tools:
- `search_docs` - Search Pinecone documentation
- `list_indexes` - List all your indexes
- `describe_index` - View details of an index
- `describe_index_stats` - View statistics of an index
- `create_index_for_model` - Create an index with integrated embeddings
- `upsert_records` - Add or update vectors
- `search_records` - Query an index
```

## Step 3: Restart Cursor

After creating/editing the configuration:
1. Close Cursor completely
2. Reopen Cursor
3. The Pinecone MCP tools should now be available

## Step 4: Verify Setup

After restarting Cursor, you should see Pinecone tools available in the MCP tools list. You can verify by:
1. Opening a chat
2. Checking if Pinecone tools appear in the available tools

## Environment Variables

Make sure your `.env.local` file has these variables:

```
# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key
VITE_PINECONE_INDEX=hall-of-jade-manuscripts
VITE_PINECONE_ENVIRONMENT=us-east-1

# OpenAI for embeddings
OPENAI_API_KEY=your_openai_api_key
```

## Testing Your Setup

1. Open the Memory Dashboard in your app (click "Memory" in the sidebar)
2. Go to the "Vector DB" tab
3. Click "Test Pinecone + Embeddings"
4. You should see "All systems operational!" if everything is configured correctly

## Troubleshooting

### MCP tools not showing up
- Verify the JSON configuration is valid
- Check that Node.js and npx are available in your PATH
- Restart Cursor completely

### Connection errors
- Verify your PINECONE_API_KEY is correct
- Check if your Pinecone project is active
- Ensure you're not hitting rate limits

### Embedding errors
- Verify your OPENAI_API_KEY is set
- Check if you have available OpenAI credits
- text-embedding-3-small is very cost-effective (~$0.0001 per 1K tokens)

## Index Information

Your index configuration:
- **Index Name:** hall-of-jade-manuscripts
- **Dimension:** 1536 (matches OpenAI text-embedding-3-small)
- **Metric:** Cosine similarity
- **Cloud:** AWS (us-east-1)

The index is created automatically when you first use the Memory Dashboard.
