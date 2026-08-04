# Chat rules

- Keep `page.tsx` focused on screen orchestration. Put database operations in the chat repository, Realtime lifecycle in hooks and visual sections in components.
- Create all Realtime filters and callbacks before calling `subscribe()`. Always remove channels during cleanup and avoid duplicate subscriptions.
- Preserve hard deletion semantics: deleting for everyone removes the message without leaving a placeholder.
- Never log message bodies, attachment URLs, auth tokens or partner identifiers.
- Verify text, emoji, attachments, voice messages, replies, editing, deletion and two-user Realtime after chat changes.
- Mobile composer controls must remain reachable above the on-screen keyboard; desktop navigation must remain available.
