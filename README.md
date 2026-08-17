# Latur Liquidation OS

All-in-one operating system for the Latur open-box / liquidation business.

## Business flow
Supplier discovery → RFQ → quotation → supplier scoring → physical audit → lot evaluation → purchase → transport → receiving → grading/testing → inventory → marketing → WhatsApp leads → sales → returns/warranty → expenses → P&L → town events.

## Stack
Next.js + TypeScript, Supabase/PostgreSQL, OpenAI, Meta WhatsApp/Ads integrations, GitHub, Vercel.

## Pilot rules
- Total capital: ₹600,000
- Maximum initial inventory: ₹450,000
- Target inventory mix: Kitchen 35%, Home/Personal Appliances 25%, Tools/Electrical 20%, Home Utility/Lifestyle 20%
- Target A/B inventory: 70%
- Maximum C: 20%
- Experimental: 10%
- First test: 15 days

## Setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Add environment variables from `.env.example`.
4. `npm install && npm run dev`.

Never commit API keys, WhatsApp tokens, database service-role keys, or payment credentials.