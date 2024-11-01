import path from "path";
import fs from "fs/promises";
import { open } from "lmdb";
import chalk from "kleur";
import debugUtil from "debug";
const debugDev = debugUtil("Dev:EleventyPluginClean");
import { isInsideDirectory, removeDirectoryIfEmpty } from "./utils.js";

const BUILD_NUMBER_KEY = null;
const OUTPUT_DIR_KEY = -10000; // -10000 does not have any meaning, but this must come before any String keys.
const OUTPUT_PATH_KEYS_START = 2;

const pluralize = function(count, singular, plural) {
  return count === 1 ? `${ count } ${ singular }` : `${ count } ${ plural }`;
};

// db.close() is not needed.
// https://github.com/Venemo/node-lmdb/issues/176#issuecomment-692341902
let db = open(".plugin-clean");
let currentBuildNumber;
let inputDir;
let outputDir;

const incrementBuildNumber = function() {
  currentBuildNumber = db.get(BUILD_NUMBER_KEY) ?? 0;
  currentBuildNumber++;
  db.put(BUILD_NUMBER_KEY, currentBuildNumber);
  debugDev(`Incremented build number to ${ currentBuildNumber }`);
};

import eleventyModulePath from "./eleventy-module-path.js";
const TemplatePassthrough = (await import(eleventyModulePath("TemplatePassthrough.js"))).default;
import { TemplatePath } from "@11ty/eleventy-utils";
import copy from "@11ty/recursive-copy";
const debug = debugUtil("Eleventy:TemplatePassthrough");
/* Types:
 * 1. via glob, individual files found
 * 2. directory, triggers an event for each file
 * 3. individual file
 */
TemplatePassthrough.prototype.copy = async function(src, dest, copyOptions) {
  if (
    !TemplatePath.stripLeadingDotSlash(dest).startsWith(
      TemplatePath.stripLeadingDotSlash(this.outputDir)
    )
  ) {
    return Promise.reject(
      new TemplatePassthroughError(
        "Destination is not in the site output directory. Check your passthrough paths."
      )
    );
  }

  let fileCopyCount = 0;
  let map = {};
  let b = this.benchmarks.aggregate.get("Passthrough Copy File");
  // returns a promise
  return copy(src, dest, copyOptions)
    .on(copy.events.COPY_FILE_START, (copyOp) => {
      // Access to individual files at `copyOp.src`
      debug("Copying individual file %o", copyOp.src);
      map[copyOp.src] = copyOp.dest;
      b.before();
    })
    .on(copy.events.COPY_FILE_COMPLETE, (copyOp) => {
      fileCopyCount++;
      b.after();
      updateFileRecord(copyOp.dest, copyOp.src);
    })
    .on(copy.events.CREATE_SYMLINK_COMPLETE, (copyOp) => {
      updateFileRecord(copyOp.dest, copyOp.src);
    })
    .then(() => {
      return {
        count: fileCopyCount,
        map,
      };
    });
}

const updateFileRecord = function(outputPath, inputPath) {
  if (typeof outputPath !== 'string' && !(outputPath instanceof String))
    return;

  let key = path.normalize(outputPath);
  debugDev(`Storing { "${ key }": ${ currentBuildNumber } }\t\t from "${ inputPath }"`);
  db.put(key, currentBuildNumber);
};

const cleanOutputDirectory = async function() {
  let oldOutputDir = db.get(OUTPUT_DIR_KEY);
  if (outputDir !== oldOutputDir) {
    if (isInsideDirectory(oldOutputDir, ".")) {
      await fs.rm(oldOutputDir, { recursive: true, force: true });

      let message = `Removed the old output directory: ${ oldOutputDir }`;
      console.log(chalk.cyan(`[eleventy-plugin-clean] ${ message }`));
    } else {
      let message = "Detected the change of the output directory.\nHowever, because it is not inside the project root, the plugin didn't touch the old output directory to avoid unintended removal.";
      console.log(chalk.yellow(`[eleventy-plugin-clean] ${ message }`));
    }

    for await (let { key: outputPath, value: buildNumber } of db.getRange({ start: OUTPUT_PATH_KEYS_START })) {
      if (buildNumber < currentBuildNumber) {
        db.remove(outputPath);
      }
    }

    db.put(OUTPUT_DIR_KEY, outputDir);
    return;
  }

  let fileCount = 0;
  let directoryCount = 0;
  await db.flushed;

  for await (let { key: outputPath, value: buildNumber } of db.getRange({ start: OUTPUT_PATH_KEYS_START })) {
    if (buildNumber < currentBuildNumber) {
      console.log("[eleventy-plugin-clean] Removing %s", outputPath);
      try {
        let response = await fs.rm(outputPath);
        fileCount++;
      } catch(e) { }

      try {
        directoryCount += await removeDirectoryIfEmpty(outputPath, outputDir);
      } catch(e) { }

      db.remove(outputPath);
    }
  }
  let nFiles = pluralize(fileCount, "file", "files");
  let nDirectories = pluralize(directoryCount, "directory", "directories");
  let message = directoryCount === 0
    ? `Removed ${ nFiles }`
    : `Removed ${ nFiles } and ${ nDirectories }`;
  console.log(chalk.cyan(`[eleventy-plugin-clean] ${ message }`));
};

const eleventyPluginClean = function(eleventyConfig) {
  inputDir = path.normalize(eleventyConfig.dir?.input ?? ".");
  outputDir = path.normalize(eleventyConfig.dir?.output ?? "_site");

  if (!db.doesExist(OUTPUT_DIR_KEY)) {
    db.put(OUTPUT_DIR_KEY, outputDir);
  }

  eleventyConfig.events.prependListener("eleventy.before", () => {
    incrementBuildNumber();
  });

  eleventyConfig.addTransform("eleventy-plugin-clean", async function(content) {
    updateFileRecord(this.outputPath, this.inputPath);
    return content;
  });

  eleventyConfig.on("eleventy.after", async () => {
    await cleanOutputDirectory();
  });
};

const plugin = {
  configFunction: eleventyPluginClean,
  updateFileRecord,
  name: "eleventy-plugin-clean"
};

export default plugin;
