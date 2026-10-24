# Next: Team page for admins and Core

Planned 2026-10-24. **Built 2026-10-25** on branch `UI` (`src/app/team/`, `src/lib/score.ts`).

## Who sees it

- Team tab for **admins and Core members**.
- Admin-only stays admin-only (see PERMISSIONS.md): approvals, recording attendance, adding members, changing tiers.

## Member page

1. **Their week first**: the landing calendar for that member (meetings with their attendance, scheduled task bars, week arrows).
2. **Below it, everything from the profile**: "Your way to Impact" (tasks finished, time in tier, hours, showing up), hours week by week (table + circle), attendance card + record, tier and rules, badges.

## Performance leaderboard (admin Team page)

- Tasks get a **size**: S = 1, M = 3, L = 8 points. Set by Core or admin when creating or assigning; members can't change it.
- **Score = points of finished tasks + 5 per full weekly commitment met.** Hours are judged against each member's own tier (GO! 4 h, Impact 10 h, Core 70 h), so tiers compete fairly; finished work dominates.
- Period: same window as the hours history (last 6 weeks), switchable to this month later if needed.
- Show the breakdown per person (points from tasks, points from hours), not just the total.
