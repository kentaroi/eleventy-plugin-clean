import path from "path";
const eleventyEleventyPath = import.meta.resolve("@11ty/eleventy");
const eleventySrcPath = path.dirname(eleventyEleventyPath);
export default function(...name) {
  return path.join(eleventySrcPath, ...name);
};
