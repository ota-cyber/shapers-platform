// Bundles the app into one self-contained HTML page for a claude.ai artifact:
// in-page routing, inlined CSS, JS and images. Run: node artifact/build.mjs
import { build } from "esbuild";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "artifact/dist");
mkdirSync(out, { recursive: true });

const images = Object.fromEntries(
  readdirSync(join(root, "public/img"))
    .filter((f) => f.endsWith(".webp"))
    .map((f) => [f.replace(".webp", ""), "data:image/webp;base64," + readFileSync(join(root, "public/img", f)).toString("base64")]),
);

const shims = {
  name: "shims",
  setup(b) {
    b.onResolve({ filter: /^next\/(link|navigation)$/ }, () => ({ path: join(root, "artifact/router.tsx") }));
    b.onResolve({ filter: /^@\/lib\/assets$/ }, () => ({ path: "assets", namespace: "assets" }));
    b.onLoad({ filter: /.*/, namespace: "assets" }, () => ({
      contents: `const m = ${JSON.stringify(images)}; export const imgSrc = (n) => m[n] ?? "";`,
      loader: "js",
    }));
  },
};

const res = await build({
  entryPoints: [join(root, "artifact/main.tsx")],
  bundle: true,
  minify: true,
  write: false,
  outdir: out,
  format: "iife",
  jsx: "automatic",
  target: "es2020",
  // The preview runs without Supabase: demo mode on the sandbox data.
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": "undefined",
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": "undefined",
    "process.env.NEXT_PUBLIC_DEMO_PASSWORD": "undefined",
    "process.env.NEXT_PUBLIC_DEMO_EMAIL_DOMAIN": "undefined",
  },
  plugins: [shims],
  logLevel: "error",
});

const js = res.outputFiles.find((f) => f.path.endsWith(".js")).text.replace(/<\/script/gi, "<\\/script");
const css = res.outputFiles.find((f) => f.path.endsWith(".css")).text;

const html = `<title>Shapers Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400&family=Hanken+Grotesk:wght@400;500&family=Instrument+Serif&display=swap">
<style>:root{--font-serif:"Instrument Serif";--font-sans:"Hanken Grotesk";--font-mono:"DM Mono";color-scheme:light}body{background:#f7f7f7;color:#333}
${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
writeFileSync(join(out, "shapers.html"), html);
console.log(`artifact/dist/shapers.html ${(html.length / 1024).toFixed(0)} KB`);
