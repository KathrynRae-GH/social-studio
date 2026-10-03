// Every color the tab uses lives here, so a public version can switch to a
// neutral theme by swapping this one file. Components use the CSS variables
// (var(--cream) and so on), never hex values.
export const boutiqlyTheme = {
  cream: "#fbf8f3", // page
  card: "#ffffff",
  border: "#e8eeeb",
  text: "#1d3c34", // Deep Forest
  muted: "#5b6f69",
  orange: "#de771f", // main action buttons only, white bold text 18px+
  green: "#276f3d", // links, secondary button hover
  paleMint: "#c4e5e2", // Suggested
  sage: "#99cc99", // Approved
  lightBlue: "#a1cfd6", // Scheduled
  deepForest: "#1d3c34", // Posted (white text)
  pink: "#e9c0d1", // Needs attention
  white: "#ffffff",
  font: "'Montserrat', system-ui, -apple-system, sans-serif",
} as const;

export type Theme = typeof boutiqlyTheme;

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(theme)) {
    root.style.setProperty(`--${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, value);
  }
}
