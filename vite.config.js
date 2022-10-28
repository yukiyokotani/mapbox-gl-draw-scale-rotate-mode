import path from "path";

import swc from "unplugin-swc";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      // eslint-disable-next-line no-undef
      entry: path.resolve(__dirname, "src/main.ts"),
      name: "mapbox-gl-draw-scale-rotate-mode",
      formats: ["esm", "cjs"],
      fileName: (format) => `index.${format}.js`,
    },
    minify: "terser",
    sourcemap: true,
  },
  plugins: [swc.vite()],
});
