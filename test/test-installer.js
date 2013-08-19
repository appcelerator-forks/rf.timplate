var installer;
if (process.env.TIMPLATE_COV) {
  installer = require('../lib-cov/installer');
} else {
  installer = require('../lib/installer');
}

var assert = require('assert');
var util = require('util');
var fs = require('fs');
var libxmljs = require('libxmljs');

function fixture (p) { return __dirname + "/installer-fixtures/" + p; }

function cp (src, dest) {
  src = fs.readFileSync(src, 'utf8');
  fs.writeFileSync(dest, src);
}

function getattr (node, attr) {
  var a = node.attr(attr);
  if (a) return a.value();
  return false;
}

function hasModule (file, name, version, platform, done) {
  fs.readFile(file, function (err, data) {
    if (err) return done(err);

    var doc = libxmljs.parseXml(data);
    var root = doc.root();

    var modules = root.get('//modules');

    var children = modules.childNodes();

    var found = 0;

    for (var i = 0; i < children.length; i++) {
      var nodePlatform = getattr(children[i], 'platform');
      var nodeVersion = getattr(children[i], 'version');

      if (nodePlatform === platform &&
          nodeVersion === version &&
          children[i].text() === name) found++;
    }

    if (found === 1) done();
    else if (found > 1) done(new Error("found module " + name + " platform " + platform + " >1 times in file " + file));
    else done(new Error("didnt find module " + name + " platform " + platform + " in file " + file));
  });
}

describe('installer', function () {

  describe('xml editor', function () {

    it('adds when tiws isnt already there', function (done) {
      cp(fixture("tiapp-without-tiws.xml"), fixture("tiapp.xml"));
      installer.addModule("net.iamyellow.tiws", "0.3", "iphone", fixture("tiapp.xml"), function (err) {
        if (err) return done(err);
        installer.addModule("net.iamyellow.tiws", "0.1", "android", fixture("tiapp.xml"), function (err) {
          if (err) return done(err);
          hasModule(fixture("tiapp.xml"), "net.iamyellow.tiws", "0.3", "iphone", function (err) {
            if (err) return done(err);
            hasModule(fixture("tiapp.xml"), "net.iamyellow.tiws", "0.1", "android", function (err) {
              if (err) return done(err);

              fs.unlink(fixture("tiapp.xml"), done);
            });
          });
        });
      });
    });


    it('adds when tiws is already there', function (done) {
      cp(fixture("tiapp-with-tiws.xml"), fixture("tiapp.xml"));
      installer.addModule("net.iamyellow.tiws", "0.3", "iphone", fixture("tiapp.xml"), function (err) {
        if (err) return done(err);
        installer.addModule("net.iamyellow.tiws", "0.1", "android", fixture("tiapp.xml"), function (err) {
          if (err) return done(err);
          hasModule(fixture("tiapp.xml"), "net.iamyellow.tiws", "0.3", "iphone", function (err) {
            if (err) return done(err);
            hasModule(fixture("tiapp.xml"), "net.iamyellow.tiws", "0.1", "android", function (err) {
              if (err) return done(err);

              fs.unlink(fixture("tiapp.xml"), done);
            });
          });
        });
      });
    });


  });

});
