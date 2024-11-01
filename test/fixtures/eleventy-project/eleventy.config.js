import clean from "../../../index.js";

export default function(eleventyConfig) {
  eleventyConfig.addPlugin(clean);

  eleventyConfig.addPassthroughCopy("**/*.foo");
  eleventyConfig.addPassthroughCopy({ "**/*.bar": "baz" });
  eleventyConfig.addPassthroughCopy("qux/qux");
  eleventyConfig.addPassthroughCopy({ "quux/quux": "quuz" });
  eleventyConfig.addPassthroughCopy("corge/corge");
  eleventyConfig.addPassthroughCopy({ "grault/grault": "garply" });
};
