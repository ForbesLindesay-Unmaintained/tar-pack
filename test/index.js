var tar = require('../')
var path = require('path')
var rfile = require('rfile')

var assert = require('assert')

describe('unpack(tarball, directory, callback', function () {
  it('unpacks the tarball into the directory', function (done) {
    tar.unpack(__dirname + '/fixtures/packed.tar', __dirname + '/output/unpacked', function (err) {
      if (err) return done(err)
      assert.equal(rfile('./output/unpacked/bar.txt'), rfile('./fixtures/to-pack/bar.txt'))
      assert.equal(rfile('./output/unpacked/foo.txt'), rfile('./fixtures/to-pack/foo.txt'))
      done()
    })
  })
})
describe('unpack(gziptarball, directory, callback', function () {
  it('unpacks the tarball into the directory', function (done) {
    tar.unpack(__dirname + '/fixtures/packed-file.txt', __dirname + '/output/unpacked', function (err) {
      if (err) return done(err)
      assert.equal(rfile('./output/unpacked/index.js'), rfile('./fixtures/packed-file.txt'))
      done()
    })
  })
})
describe('unpack(file, directory, callback', function () {
  it('copies the file into the directory', function (done) {
    tar.unpack(__dirname + '/fixtures/packed.tar.gz', __dirname + '/output/unpacked', function (err) {
      if (err) return done(err)
      assert.equal(rfile('./output/unpacked/bar.txt'), rfile('./fixtures/to-pack/bar.txt'))
      assert.equal(rfile('./output/unpacked/foo.txt'), rfile('./fixtures/to-pack/foo.txt'))
      done()
    })
  })
})
describe('pack(directory, tarball, callback', function () {
  it('packs the directory into the output', function (done) {
    tar.pack(__dirname + '/fixtures/to-pack', __dirname + '/output/packed.tar.gz', function (err) {
      if (err) return done(err)
      tar.unpack(__dirname + '/output/packed.tar.gz', __dirname + '/output/unpacked', function (err) {
        if (err) return done(err)
        assert.equal(rfile('./output/unpacked/bar.txt'), rfile('./fixtures/to-pack/bar.txt'))
        assert.equal(rfile('./output/unpacked/foo.txt'), rfile('./fixtures/to-pack/foo.txt'))
        done()
      })
    })
  })
})