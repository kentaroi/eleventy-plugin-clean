import clean from "../../../index.js";

export default function(eleventyConfig) {
  eleventyConfig.addPlugin(clean);

  eleventyConfig.addPassthroughCopy("**/*.foo");
  eleventyConfig.addPassthroughCopy({ "**/*.bar": "baz" });
  eleventyConfig.addPassthroughCopy("src/**/*.qux");
  eleventyConfig.addPassthroughCopy({ "src/**/*.quux": "quuz" });

  eleventyConfig.addPassthroughCopy("corge/corge");
  eleventyConfig.addPassthroughCopy({ "grault/grault": "garply" });
  eleventyConfig.addPassthroughCopy("waldo/waldo");
  eleventyConfig.addPassthroughCopy({ "fred/fred": "plugh" });

  eleventyConfig.addPassthroughCopy("src/xyzzy/xyzzy");
  eleventyConfig.addPassthroughCopy({ "src/thud/thud": "hoge" });
  eleventyConfig.addPassthroughCopy("src/fuga/fuga");
  eleventyConfig.addPassthroughCopy({ "src/piyo/piyo": "hogera" });

  return { dir: { input: "src", output: "dist" } };
};
