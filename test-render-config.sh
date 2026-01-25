#!/bin/bash
# Test Render Deployment Configuration Locally
# This script validates your setup before deploying to Render

echo "🔍 Render Deployment Configuration Checker"
echo "==========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: render.yaml exists
echo "1️⃣  Checking render.yaml..."
if [ -f "render.yaml" ]; then
    echo -e "${GREEN}✓${NC} render.yaml found"
else
    echo -e "${RED}✗${NC} render.yaml not found in current directory"
fi
echo ""

# Check 2: server/package.json exists
echo "2️⃣  Checking server dependencies..."
if [ -f "server/package.json" ]; then
    echo -e "${GREEN}✓${NC} server/package.json found"
    echo "   Dependencies:"
    grep -E '(express|cors|mongoose|dotenv)' server/package.json | head -4
else
    echo -e "${RED}✗${NC} server/package.json not found"
fi
echo ""

# Check 3: .env configuration
echo "3️⃣  Checking environment files..."
if [ -f "server/.env" ]; then
    echo -e "${GREEN}✓${NC} server/.env exists (for local testing)"
    if grep -q "MONGODB_URI" server/.env; then
        echo "   ✓ MONGODB_URI is configured"
    else
        echo -e "   ${YELLOW}⚠${NC}  MONGODB_URI not found (will need to add in Render)"
    fi
else
    echo -e "${YELLOW}⚠${NC}  server/.env not found (normal - will use Render env vars)"
fi

if [ -f "server/.env.template" ]; then
    echo -e "${GREEN}✓${NC} server/.env.template found"
else
    echo -e "${RED}✗${NC} server/.env.template not found"
fi
echo ""

# Check 4: API configuration
echo "4️⃣  Checking API configuration..."
if [ -f "js/api-config.js" ]; then
    echo -e "${GREEN}✓${NC} js/api-config.js found"
    if grep -q "render.com\|onrender" js/api-config.js; then
        echo "   ✓ Render domain detection is configured"
    else
        echo -e "   ${YELLOW}⚠${NC}  Render domain detection not found (but defaults will work)"
    fi
else
    echo -e "${RED}✗${NC} js/api-config.js not found"
fi
echo ""

# Check 5: Frontend files exist
echo "5️⃣  Checking frontend files..."
frontend_files=("index.html" "login.html" "register.html")
found=0
for file in "${frontend_files[@]}"; do
    if [ -f "$file" ]; then
        ((found++))
    fi
done
echo -e "${GREEN}✓${NC} Found $found frontend HTML files"
echo ""

# Check 6: Server startup
echo "6️⃣  Checking server configuration..."
if [ -f "server/index.js" ]; then
    echo -e "${GREEN}✓${NC} server/index.js found"
    if grep -q "startServer\|app.listen" server/index.js; then
        echo "   ✓ Server startup code found"
    fi
else
    echo -e "${RED}✗${NC} server/index.js not found"
fi
echo ""

# Check 7: Deployment guides
echo "7️⃣  Checking deployment documentation..."
docs=("RENDER_DEPLOYMENT.md" "RENDER_QUICK_START.md")
for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "${GREEN}✓${NC} $doc found"
    else
        echo -e "${RED}✗${NC} $doc missing"
    fi
done
echo ""

# Check 8: Git configuration
echo "8️⃣  Checking git setup..."
if [ -d ".git" ]; then
    echo -e "${GREEN}✓${NC} Repository initialized"
    remote=$(git remote get-url origin 2>/dev/null)
    if [ -n "$remote" ]; then
        echo "   ✓ Remote: $remote"
    else
        echo -e "   ${YELLOW}⚠${NC}  No git remote configured - run: git remote add origin <github-url>"
    fi
else
    echo -e "${YELLOW}⚠${NC}  Not a git repository - run: git init && git remote add origin <github-url>"
fi
echo ""

# Summary
echo "==========================================="
echo "✅ Configuration Check Complete!"
echo ""
echo "📝 Next Steps:"
echo "   1. Review RENDER_QUICK_START.md (5-minute setup)"
echo "   2. Set up MongoDB Atlas or use Render's MongoDB"
echo "   3. Get Paychangu keys (if using payments)"
echo "   4. Configure SMTP (if using email)"
echo "   5. Push code: git push origin main"
echo "   6. Deploy via Render Dashboard"
echo ""
echo "💡 For detailed guide: See RENDER_DEPLOYMENT.md"
