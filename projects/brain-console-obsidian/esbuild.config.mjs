import esbuild from "esbuild";

const prod = process.argv.includes("production");

const result = await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*"],
  format: "cjs",
  platform: "browser",
  target: "ES2022",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "dist/main.js",
  logLevel: "info",
}).catch(() => process.exit(1));

console.log("✓ Brain Console bundled to dist/main.js");
