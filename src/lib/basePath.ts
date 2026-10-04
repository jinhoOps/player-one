// GitHub Pages serves the app under /player-one. next/link and the router add
// the prefix themselves; raw URLs (model files, OAuth redirect) need this.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
