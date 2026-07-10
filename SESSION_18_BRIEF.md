# V Wholesale — Session 18 Brief
**Date:** 10 July 2026
**Repo:** hmehtavw/vwholesale-app | **Supabase:** ndamdnlsuktucqtcbhgp
**Live:** https://vwholesale.in | **Working dir:** /home/claude/repo9
**PAT:** GITHUB_PAT_REDACTED
**Staff login:** 9038010175 / PIN 141820

## What is live right now

### Portals
- vwholesale.in → Customer shop (index.html = shop.html)
- vwholesale.in/staff/ → Staff portal
- vwholesale.in/admin/ → Admin portal
- vwholesale.in/professionals/ → Contractor portal
- vwholesale.in/marketing/ → Marketing Intelligence Panel

### Marketing panel built this session
- AI CMO briefing (GPT-4o-mini, $0.0097/run, working)
- Content Studio (text in EN/TE/HI)
- GBP Post Generator
- Content Calendar with weekly rhythm
- Approvals Queue
- Analytics + GA4 setup
- AI Agents registry (6 agents)
- Brand Knowledge base
- Integrations tracker
- Audit Logs + Settings
- Edge function: marketing-ai deployed with OPENAI_API_KEY

### Infrastructure
- OpenAI: connected + credits added, working
- Interakt WhatsApp: setup stage
- Meta Instagram/Facebook: NOT connected
- Google Analytics 4: NOT connected
- GBP: live, vwholesale.in pending approval
- Search Console: verified, sitemap live (5 pages)

## Session 18 — Build these in order

### 1. Brand Profile page in marketing.html
- Upload logo → Supabase storage (brand_profile table)
- Upload 5-10 store/lifestyle photos
- Colors: navy #1a2744, gold #c9a84c
- Saved once, auto-fetched on every poster

### 2. AI Poster Generator (full)
- GPT-4o-mini writes text (topic → headline + sub + features + CTA)
- DALL-E 3 generates hero lifestyle image
- HTML Canvas composites: logo + DALL-E + text + category strip + footer
- Style: Navy/Gold split — left=content, right=hero image
- Bottom: TILES / GRANITE / SANITARYWARE / PAINTS / ELECTRICALS strip
- Footer: navy bar + phone + web + gold CTA
- "PREMIUM QUALITY" starburst badge
- Output: 1080x1080 PNG download

### 3. Direct Publishing (not just download)
- Instagram via Meta Graph API
- Facebook via Meta Graph API
- GBP via Google API
- WhatsApp via Interakt (when ready)
- Admin only can publish — others draft only

### 4. Post Management
- Schedule with date/time
- Calendar queue
- Published history + performance
- Repost/repurpose across platforms

### 5. Meta Business connection guide
- Create Meta App
- OAuth for Graph API
- Store tokens in Supabase secrets

## Design to match
ChatGPT poster style:
- Navy #1a2744 + Gold #c9a84c + White
- Split: content left, lifestyle photo right
- Product category strip bottom
- Professional, realistic, premium
- "Build Better. Pay Less." tagline

## New Supabase tables needed
- brand_profile
- poster_history
- social_connections

## Key decisions
- vwholesale.in primary, vwholesalemart.com = 301 redirect
- Budget: Rs 30,000/month, Himansu sole approver
- Telugu primary + English + Hindi
- Interakt for WhatsApp
- Model agnostic (OpenAI + Claude A/B)
- Native scheduler first
