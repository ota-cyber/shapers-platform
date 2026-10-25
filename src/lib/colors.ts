// Sticky-note colours, one per project, like the rows on the team's Miro board.
// The only colour in the app: everything else stays Co–Star monochrome.
const STICKY = ["#cfe6a8", "#f3b0aa", "#9fdcab", "#a9c3ef", "#f5df86", "#a9dff0", "#f6bb8c", "#f3eaa4", "#ecaee0", "#c2e58e"];

export function projectColor(projectIds: string[], id: string): string {
  const i = projectIds.indexOf(id);
  return STICKY[(i < 0 ? 0 : i) % STICKY.length];
}

export const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
