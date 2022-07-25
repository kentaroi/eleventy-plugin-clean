# eleventy-plugin-clean
[![npm](https://img.shields.io/npm/v/eleventy-plugin-clean)](https://www.npmjs.com/package/eleventy-plugin-clean)
[![CI](https://github.com/kentaroi/eleventy-plugin-clean/workflows/CI/badge.svg?branch=main)](https://github.com/kentaroi/eleventy-plugin-clean/actions?query=branch%3Amain+workflow%3ACI)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/kentaroi/eleventy-plugin-clean/blob/main/LICENSE)

This is an experimental plugin for [Eleventy](https://github.com/11ty/eleventy) to keep [the output directory](https://www.11ty.dev/docs/config/#output-directory) clean.

The plugin does not delete any files not created by [Eleventy](https://github.com/11ty/eleventy). It deletes all the files, previously created by [Eleventy](https://github.com/11ty/eleventy) but no longer created/updated, in [the output directory](https://www.11ty.dev/docs/config/#output-directory).

⚠️ Don't use weird `input` and `output` directories setup even if the official doc recommends, such as
[https://www.11ty.dev/docs/usage/#using-the-same-input-and-output](https://www.11ty.dev/docs/usage/#using-the-same-input-and-output).

## Installation

```bash
npm install eleventy-plugin-clean
```

Add it to Eleventy config file (usually `.eleventy.js`)

```javascript
const clean = require("eleventy-plugin-clean");

module.exports = function(eleventyConfig) {
  eleventyConfig.addPlugin(clean);
};
```

If you are using `git`, add the following line to your `.gitignore`.
```gitignore
.plugin-clean
```

If you are not using `git`, add it to your `.eleventyignore` file instead of the `.gitignore` file.

## Usage

eleventy-plugin-clean does not delete files which were not written by Eleventy or had been created before the installation of the plugin.

Therefore, you may want to clean the `output` directory once before using it.
```bash
rm -rf _site/*
```

## What it actually does

eleventy-plugin-clean uses LMDB, a key-value store, to store all the data needed to keep the `output` directory clean. The DB is located at `.plugin-clean` in your project root.

It keeps the build number of Eleventy project.
The build number is an integer value that it automatically increases with each Eleventy build.

It uses the key-value store to store build numbers for the files in the `output` directory.
In other words, eleventy-plugin-clean knows all of the files in the `output` directory and each of the file records has its build number that generated the file.

When Eleventy (re)builds the site, it updates the build numbers for all of the output files generated by the build.

At the end of each build, it removes the files in the `output` directory which have a build number older than the current build number and deletes their records from the key-value store.

## Plugins

If you are using plugins that write files in the output directory by itself instead of using Eleventy, [eleventy-plugin-clean](https://github.com/kentaroi/eleventy-plugin-clean) does not delete such files when they are no longer created/updated.

Such plugins need to call `updateFileRecord(outputPath, inputPath)` for files to be managed by [eleventy-plugin-clean](https://github.com/kentaroi/eleventy-plugin-clean).

For example, [eleventy-sass](https://github.com/kentaroi/eleventy-sass) does call `updateFileRecord()`, and all of the files in the output directory will be managed by [eleventy-plugin-clean](https://github.com/kentaroi/eleventy-plugin-clean).

([eleventy-sass](https://github.com/kentaroi/eleventy-sass) do use Eleventy's file writing functionality for CSS files compiled from Sass/SCSS files, but writes only source map files by itself, and it calls `updateFileRecord()` only for the source map files.)

## API
`updateFileRecord(outputPath, inputPath)` is the only API function. It is used for files to be managed by [eleventy-plugin-clean](https://github.com/kentaroi/eleventy-plugin-clean).

`inputPath` is optional and used only for debug purpose. Therefore, you can call it only with `outputPath`.

```javascript
const clean = require("eleventy-plugin-clean");

clean.updateFileRecord(outputPath);
```

## Limitations

Suppose you are running `npx @11ty/eleventy --serve`.

eleventy-plugin-clean does not detect file deletions since Eleventy doesn't listen `unlink` events but only listens `change` and `add` events:

https://github.com/11ty/eleventy/blob/1db6a10a98f35b6f6bcac94222cdd8597e6f7928/src/Eleventy.js#L953-L961

Therefore, when you remove a file from your `input` directory, nothing will happen.

However, after that, if you change or add another file or if you re-run `npx @11ty/eleventy --serve` or `npx @11ty/eleventy`, it will remove the file(s) in the `output` directory which had been generated from the above removed file.
