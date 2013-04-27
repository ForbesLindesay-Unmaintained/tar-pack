"use strict"

var debug = require('debug')('tar-pack')
var uidNumber = require('uid-number')
var rm = require('rimraf')
var tar = require('tar')
var once = require('once')
var fstream = require('fstream')
var packer = require('fstream-ignore')

var zlib = require('zlib')
var path = require('path')
var fs
try {
  fs = require('graceful-fs')
} catch (ex) {
  fs = require('fs')
}

var win32 = process.platform === 'win32'
var myUid = process.getuid && process.getuid()
var myGid = process.getgid && process.getgid()

if (process.env.SUDO_UID && myUid === 0) {
  if (!isNaN(process.env.SUDO_UID)) myUid = +process.env.SUDO_UID
  if (!isNaN(process.env.SUDO_GID)) myGid = +process.env.SUDO_GID
}

exports.pack = pack
exports.unpack = unpack

function pack(folder, tarball, options, cb) {
  if (typeof cb != 'function') {
    cb = options
    options = undefined
  }
  cb = once(cb)
  options = options || {}
  if (typeof folder === 'string') {

    var filter = options.filter || function (entry) { return true; }

    folder = packer({
      path: folder,
      type: 'Directory',
      isDirectory: true,
      ignoreFiles: options.ignoreFiles || ['.gitignore'],
      filter: function (entry) { // {path, basename, dirname, type} (type is "Directory" or "File")
        var basename = entry.basename
        // some files are *never* allowed under any circumstances
        // these files should always be either temporary files or
        // version control related files
        if (basename === '.git' || basename === '.lock-wscript' || basename.match(/^\.wafpickle-[0-9]+$/) ||
            basename === 'CVS' || basename === '.svn' || basename === '.hg' || basename.match(/^\..*\.swp$/) ||
            basename === '.DS_Store' ||  basename.match(/^\._/)) {
          return false
        }
        //always exclude self
        if (entry.path === path.resolve(tarball)) return false;
        //custom excludes
        return filter(entry)
      }
    })
  }
  folder
    .on('error', function (er) {
      if (er) debug('Error reading folder')
      return cb(er)
    })
    // By default, npm includes some proprietary attributes in the
    // package tarball.  This is sane, and allowed by the spec.
    // However, npm *itself* excludes these from its own package,
    // so that it can be more easily bootstrapped using old and
    // non-compliant tar implementations.
    .pipe(tar.Pack({ noProprietary: options.noProprietary || false }))
    .on('error', function (er) {
      if (er) debug('tar creation error ' + tarball)
      cb(er)
    })
    .pipe(zlib.Gzip())
    .on('error', function (er) {
      if (er) debug('gzip error ' + tarball)
      cb(er)
    })
    .pipe(fstream.Writer({ type: 'File', path: tarball }))
    .on('error', function (er) {
      if (er) debug('Could not write ' + tarball)
      cb(er)
    })
    .on('close', cb)
}

function unpack(tarball, unpackTarget, options, cb) {
  if (typeof cb !== 'function') cb = options, options = undefined

  cb = once(cb)

  var parent = path.dirname(unpackTarget)
  var base = path.basename(unpackTarget)

  options = options || {}
  var gid = options.gid || null
  var uid = options.uid || null
  var dMode = options.dmode || 0x0777 //npm.modes.exec
  var fMode = options.fmode || 0x0666 //npm.modes.file
  var defaultName = options.defaultName || (options.defaultName === false ? false : 'index.js')

  // figure out who we're supposed to be, if we're not pretending
  // to be a specific user.
  if (options.unsafe && !win32) {
    uid = myUid
    gid = myGid
  }

  var pending = 2
  uidNumber(uid, gid, function (er, uid, gid) {
    if (er) return cb(er)
    if (0 === --pending) next()
  })
  rm(unpackTarget, function (er) {
    if (er) return cb(er)
    if (0 === --pending) next()
  })
  function next() {
    // gzip {tarball} --decompress --stdout \
    //   | tar -mvxpf - --strip-components=1 -C {unpackTarget}
    gunzTarPerm(tarball, unpackTarget, dMode, fMode, uid, gid, defaultName, cb)
  }
}


function gunzTarPerm(tarball, target, dMode, fMode, uid, gid, defaultName, cb) {
  debug('modes %j', [dMode.toString(8), fMode.toString(8)])

  var fst = fs.createReadStream(tarball)

  function fixEntry(entry) {
    debug('fixEntry %j', entry.path)
    // never create things that are user-unreadable,
    // or dirs that are user-un-listable. Only leads to headaches.
    var originalMode = entry.mode = entry.mode || entry.props.mode
    entry.mode = entry.mode | (entry.type === 'Directory' ? dMode : fMode)
    entry.props.mode = entry.mode
    if (originalMode !== entry.mode) {
      debug('modified mode %j', [entry.path, originalMode, entry.mode])
    }

    // if there's a specific owner uid/gid that we want, then set that
    if (!win32 &&  typeof uid === 'number' && typeof gid === 'number') {
      entry.props.uid = entry.uid = uid
      entry.props.gid = entry.gid = gid
    }
  }

  var extractOpts = { type: 'Directory', path: target, strip: 1 }

  if (!win32 && typeof uid === 'number' && typeof gid === 'number') {
    extractOpts.uid = uid
    extractOpts.gid = gid
  }

  extractOpts.filter = function () {
    // symbolic links are not allowed in packages.
    if (this.type.match(/^.*Link$/)) {
      debug('excluding symbolic link: ' + this.path.substr(target.length + 1) + ' -> ' + this.linkpath)
      return false
    }
    return true
  }


  fst.on('error', function (er) {
    if (er) debug('error reading ' + tarball)
    cb(er)
  })

  type(fst, function (err, type) {
    if (err) return cb(err);
    if (type === 'gzip') {
      fst = fst
        .pipe(zlib.Unzip())
        .on('error', function (er) {
          if (er) debug('unzip error ' + tarball)
          cb(er)
        })
      type = 'tar'
    }
    if (type === 'tar') {
      fst
        .pipe(tar.Extract(extractOpts))
        .on('entry', fixEntry)
        .on('error', function (er) {
          if (er) debug('untar error ' + tarball)
          cb(er)
        })
        .on('close', function () {
          cb(null, 'directory')
        })
      return
    }
    if (type === 'naked-file' && defaultName) {
      var jsOpts = { path: path.resolve(target, defaultName) }

      if (!win32 && typeof uid === 'number' && typeof gid === 'number') {
        jsOpts.uid = uid
        jsOpts.gid = gid
      }

      fst
        .pipe(fstream.Writer(jsOpts))
        .on('error', function (er) {
          if (er) log.error('tar.unpack', 'copy error '+tarball)
          cb(er)
        })
        .on('close', function () {
          cb(null, 'file')
        })
      return
    }

    return cb(new Error('Unrecognised package type'));
  })
}

function type(stream, callback) {
  stream.on('error', handle)
  stream.on('data', parse)
  function handle(err) {
    callback(err)
    stream.removeListener('data', parse)
    stream.removeListener('error', handle)
  }
  function parse(chunk) {
    // detect what it is.
    // Then, depending on that, we'll figure out whether it's
    // a single-file module, gzipped tarball, or naked tarball.

    // gzipped files all start with 1f8b08
    if (chunk[0] === 0x1F && chunk[1] === 0x8B && chunk[2] === 0x08) {
      callback(null, 'gzip')
    } else if (chunk.toString().match(/^package\/\u0000/)) {
      // note, this will only pick up on tarballs with a root directory called package
      callback(null, 'tar')
    } else {
      callback(null, 'naked-file')
    }

    // now un-hook, and re-emit the chunk
    stream.removeListener('data', parse)
    stream.removeListener('error', handle)
    stream.emit('data', chunk)
  }
}