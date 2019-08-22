import vue from "rollup-plugin-vue";
import cjs from "rollup-plugin-commonjs";

export default {
  input: "components/DynamicMarkdown.vue",
  output: {
    format: "esm",
    file: "dist/DynamicMarkdown.js"
  },
  plugins: [vue(), cjs()],
  external: ["vue"]
};
