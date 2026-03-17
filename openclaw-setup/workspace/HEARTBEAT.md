# Heartbeat Checklist

- Read `C:\Users\jackw\Desktop\SwjshAlgoKnife\src\app\api\agents\agents_db.json` — any agent HALTED or consecutive_losses >= 2?
- Query `C:\Users\jackw\Desktop\SwjshAlgoKnife\journal.db`: `SELECT COUNT(*) FROM trades WHERE status='PENDING' AND datetime(entry_date) < datetime('now','-30 minutes')` — stale trades?
- Query: `SELECT COUNT(*) FROM trades WHERE status='OPEN' AND date(entry_date) < date('now')` — overnight positions still open?
- If market hours (9:30 AM–4 PM ET weekdays): confirm trading agents are ACTIVE, not stuck.
- If anything is wrong: post a specific alert to Discord #chief-main.
- If everything is normal: reply HEARTBEAT_OK.
