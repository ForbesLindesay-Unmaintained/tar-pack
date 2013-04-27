# Tar Pack

Package and un-package modules of some sort (in tar/gz bundles).  This is mostly useful for package managers.  Note that it doesn't check for or touch `package.json` so it can be used even if that's not the way you store your package info.

[![Build Status](https://travis-ci.org/ForbesLindesay/tar-pack.png?branch=master)](https://travis-ci.org/ForbesLindesay/tar-pack)
[![Dependency Status](https://gemnasium.com/ForbesLindesay/tar-pack.png)](https://gemnasium.com/ForbesLindesay/tar-pack)

## Installation

    $ npm install tar-pack

## API

### pack(folder|packer, tarball, [options,] cb)

Pack the folder at `folder` into a gzipped tarball located at `tarball` then call cb with an optional error.  Files ignored by `.gitignore` will not be in the package.

You can optionally pass a `fstream.DirReader` directly, instead of folder.  For example, to create an npm package, do:

```js
pack(require("fstream-npm")(folder), tarball, [options], cb)
```

Options:

 - `noProprietary` (defaults to `false`) Set this to `true` to prevent any proprietary attributes being added to the tarball.  These attributes are allowed by the spec, but may trip up some poorly written tarball parsers.
 - `ignoreFiles` (defaults to `['.gitignore']`) These files can specify files to be excluded from the package using the syntax of `.gitignore`.  This option is ignored if you parse a `fstream.DirReader` instead of a string for folder.
 - `filter` (defaults to `entry => true`) A function that takes an entry and returns `true` if it should be included in the package and `false` if it should not.  Entryies are of the form `{path, basename, dirname, type}` where (type is "Directory" or "File").  This function is ignored if you parse a `fstream.DirReader` instead of a string for folder.

### unpack(tarball, folder, [options,] cb)

Unpack the tarball at `tarball into a folder at `folder`.  N.B. the output folder will be removed first if it already exists.

The callback is called with an optional error and, as its second argument, a string which is one of:

 - `'directory'`, indicating that the extracted package was a directory (either `.tar.gz` or `.tar`)
 - `'file'`, incating that the extracted package was just a single file (extracted to `defaultName`, see options)

Basic Options:

 - `defaultName` (defaults to `index.js`) If the package is a single file, rather than a tarball, it will be "extracted" to this file name, set to `false` to disable.

Advanced Options (you probably don't need any of these):

 - `gid` - (defaults to `null`) the `gid` to use when writing files
 - `uid` - (defaults to `null`) the `uid` to use when writing files
 - `dmode` - (defaults to `0777`) The mode to use when creating directories
 - `fmode` - (defaults to `0666`) The mode to use when creating files
 - `unsafe` - (defaults to `false`) (on non win32 OSes it overrides `gid` and `uid` with the current processes IDs)

## License

  BSD