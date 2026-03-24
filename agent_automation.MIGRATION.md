# Agent Automation Migration

To apply the new agent automation tables, run:

```
mysql -h <host> -u <user> -p <database> < agent_automation.sql
```

This migration adds:
- agent_state
- agent_memory
- agent_activity_log
- agent_plans
- agent_action_history

All tables are linked to the existing agents table.

**Required for full agent automation.**
