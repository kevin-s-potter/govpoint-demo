# GovPoint Database Setup — Step by Step

## What You Need
- A GitHub account (you already have one)
- 10 minutes

## Step 1: Create Supabase Project

1. Go to **[supabase.com](https://supabase.com)**
2. Click **"Start your project"** → sign in with GitHub
3. Click **"New Project"**
   - **Organization**: Your personal org (auto-created)
   - **Name**: `govpoint`
   - **Database Password**: Pick something strong, **save it** (you'll need it later)
   - **Region**: `US East (N. Virginia)` — closest to Ohio
4. Click **"Create new project"** — wait ~2 minutes

## Step 2: Create Tables

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `01_create_tables.sql` from this folder
4. Copy the **entire contents** and paste into the SQL Editor
5. Click **"Run"** (or Ctrl+Enter)
6. You should see: `Success. No rows returned` — that's correct

## Step 3: Load Data

1. Still in SQL Editor, click **"New query"** again
2. Open `02_seed_data.sql` from this folder
3. Copy the entire contents and paste
4. Click **"Run"**
5. At the bottom you'll see the verification query results — confirm counts match:
   - rules: **23**
   - rule_conditions: **46**
   - users: **3**
   - (full expected counts are at the bottom of the SQL file)

## Step 4: Verify in Table Editor

1. Click **"Table Editor"** in the left sidebar
2. You should see all 11 tables listed
3. Click **"rules"** — you'll see all 23 rules with their full data
4. Click **"rule_conditions"** — 46 structured conditions
5. Browse around — this is your database!

## Step 5: Test the API

Supabase auto-generates a REST API. To test it:

1. Click **"Project Settings"** (gear icon) → **"API"**
2. Copy your **Project URL** (looks like `https://abcdefg.supabase.co`)
3. Copy your **anon/public key** (the long string)
4. Open a new browser tab and go to:

```
https://YOUR_PROJECT_URL/rest/v1/rules?select=rule_id,name,status,citation&apikey=YOUR_ANON_KEY
```

You should see JSON with all 23 rules. That's your live API.

## Step 6: Save Your Credentials

You'll need these two values to wire the demo:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

**Do NOT commit these to GitHub.** They'll go in a `.env` file or Vercel environment variables.

## What's Next

Once the database is up and verified, we'll:
1. Update `data/api.js` to read from Supabase instead of `schema.json`
2. Refactor `ontology.html` to use the API layer
3. The demo becomes a live, data-driven application

## File Inventory

| File | Purpose |
|------|---------|
| `01_create_tables.sql` | Creates all 11 tables with indexes and constraints |
| `02_seed_data.sql` | Inserts all demo data (23 rules, conditions, users, etc.) |
| `schema.json` | JSON representation of the same data (used by current demo) |
| `api.js` | JavaScript abstraction layer (works with JSON today, Supabase tomorrow) |
