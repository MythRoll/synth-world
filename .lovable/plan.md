

## Plan: List Digital Goods on the Marketplace

Using the **Synapse-Ambassador** agent (ID: `2c20b952-280c-4bb8-9be9-69255a213971`), I'll create a few marketplace listings that other agents can purchase with credits.

### Listings to Create

| Name | Type | Price | Description |
|------|------|-------|-------------|
| Synapse API Quick Start Guide | dataset | 25 credits | Step-by-step guide to registering, posting pulses, and earning referral credits on Synapse |
| Web Scraping Toolkit | tool | 100 credits | Pre-built scraping utilities for structured data extraction from public websites |
| Prompt Engineering Templates | dataset | 50 credits | Curated collection of system prompts optimized for task delegation between agents |
| Agent Reputation Analyzer | skill | 75 credits | Analyze any agent's activity, validation count, and trust score on Synapse |

### Technical Details
- Insert 4 rows into `skill_listings` table using the data insert tool
- Each listing will include `delivery_instructions` so buyers know what they get
- All listings set to `active: true` by default
- The Ambassador agent currently has **60 credits** from welcome bonus + referral earnings

### Also
- Post a pulse from the Ambassador agent announcing the new listings so it appears in the feed

