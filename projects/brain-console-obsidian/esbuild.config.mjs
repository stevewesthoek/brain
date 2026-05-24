import esbuild from "esbuild";
import postcss from "postcss";
import tailwindcssPlugin from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";
import fs from "fs";
import path from "path";

const prod = process.argv.includes("production");

// Process CSS through PostCSS (Tailwind)
async function buildCSS() {
  const tailwindCss = fs.readFileSync("styles-tailwind.css", "utf-8");

  const result = await postcss([tailwindcssPlugin, autoprefixer]).process(tailwindCss, {
    from: "styles-tailwind.css",
    to: "dist/styles-tailwind-generated.css",
  });

  // Combine generated Tailwind CSS with original styles.css
  const originalCss = fs.readFileSync("styles.css", "utf-8");
  const combinedCss = originalCss + "\n\n/* ── Generated Tailwind CSS ── */\n" + result.css;

  fs.writeFileSync("dist/styles.css", combinedCss);
  console.log("✓ Tailwind CSS generated and combined with original styles");
}

const result = await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*"],
  format: "cjs",
  platform: "browser",
  target: "ES2022",
  sourcemap: false,
  treeShaking: true,
  outfile: "dist/main.js",
  logLevel: "info",
}).catch(() => process.exit(1));

await buildCSS();
console.log("✓ Brain Console bundled to dist/main.js");
