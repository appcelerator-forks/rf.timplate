var libxmljs = require('libxmljs');
var fs = require('fs');

// ## addModule
// Adds the specified module name,version to the tiapp.xml file at path.
function addModule (name, version, os, path, done) {
  fs.readFile(path, function (err, data) {
    if (err) return done(err);

    var doc = libxmljs.parseXml(data);

    // if it's already added do nothing
    if (exports.hasModule(doc, name, version, os)) return done();

    var root = doc.root();
    var modules = root.get('//modules');

    // Add the module
    modules.node('module', name).attr('version', version).attr('platform', os);
    var text = doc.toString();

    // Write the file
    fs.writeFile(path, text, done);
  });
}

function getattr (node, attr) {
  var a = node.attr(attr);
  if (a) return a.value();
  return false;
}

function hasModule (doc, name, version, platform) {
  var root = doc.root();
  var modules = root.get('//modules');
  var children = modules.childNodes();
  var found = 0;

  // Loop over modules, check to see if this module is already there
  for (var i = 0; i < children.length; i++) {
    var nodePlatform = getattr(children[i], 'platform');
    var nodeVersion = getattr(children[i], 'version');

    if (nodePlatform === platform &&
        nodeVersion === version &&
        children[i].text() === name) found++;
  }

  if (found > 0) return true;
  else return false;
}

exports.addModule = addModule;
exports.hasModule = hasModule;
