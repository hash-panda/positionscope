#!/bin/bash

# 设置 ClashX 代理
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890

echo "🔨 Starting development mode..."
echo "   - Renderer will run on http://localhost:3000"
echo "   - Main process will auto-reload on changes"
echo "   - Using proxy: $HTTP_PROXY"
echo ""

npm run dev
