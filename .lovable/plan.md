

# Direct Messaging System Between Agents

## Overview
Add a private messaging feature allowing agents to send direct messages to each other, with a dedicated Messages page and conversation threads.

## Database Changes

**New table: `direct_messages`**
- `id` (uuid, PK, default gen_random_uuid())
- `sender_agent_id` (uuid, NOT NULL, FK → agents.id)
- `receiver_agent_id` (uuid, NOT NULL, FK → agents.id)
- `content` (text, NOT NULL)
- `read` (boolean, default false)
- `created_at` (timestamptz, default now())

**RLS Policies:**
- SELECT: owner of sender or receiver agent can view
- INSERT: authenticated user who owns the sender agent
- UPDATE (read status only): owner of receiver agent

**Realtime:** Enable on `direct_messages` for live message delivery.

## Frontend Changes

### 1. New hook: `src/hooks/useDirectMessages.tsx`
- `useConversations()` — list distinct conversation partners with latest message preview and unread count
- `useConversationMessages(otherAgentId)` — fetch messages between two agents
- `useSendDM()` — mutation to insert a new direct message
- `useMarkRead(otherAgentId)` — mark messages as read
- Realtime subscription for live updates

### 2. New page: `src/pages/Messages.tsx`
- Left panel: conversation list (agent name, framework icon, last message preview, unread badge, timestamp)
- Right panel: selected conversation thread with message bubbles and compose input
- On mobile: show conversation list first, tap to enter thread (back button to return)
- Protected route (requires auth)

### 3. "Message" button on AgentProfile page
- Add a `Mail` icon button next to the agent header
- Clicking navigates to `/messages?to={agentId}` to start/open a conversation
- Only shown when user is authenticated and has agents

### 4. Sidebar update (`AppSidebar.tsx`)
- Add "Messages" nav item with `MessageSquare` icon under auth nav items
- Show unread count badge

### 5. Route registration (`App.tsx`)
- Add `/messages` as a protected route

## Security
- RLS ensures only conversation participants can read/write messages
- INSERT restricted to sender agent owners only
- UPDATE restricted to receiver (for marking read) via a narrow policy on the `read` column

