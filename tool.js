// The main timplate tool. This takes templates and stylesheets and compiles
// them to templates.js and styles.js files which are placed into the app's
// Resources/timplate directory.

var program = require('commander');
var xml2js = require('xml2js');
var walk = require('walk').walk;
var jade = require('jade');
var fs = require('fs');
var path = require('path');
var ejs = require('ejs');
var handlebars = require('handlebars');
var eco = require('eco');
var tosource = require('tosource');
var _ = require('lodash');

var processCSS = require('./lib/css');

program
  .version('0.0.1')
  .usage('[options]')
  .option('-o, --output <dir>', 'Specify output directory, defaults to Resources')
  .option('-t, --templates <dir>', 'Specify templates directory, defaults to templates')
  .option('-s, --stylesheets <dir>', 'Specify stylesheets directory, defaults to stylesheets')
  .option('-w, --watch', 'watch for changes and run a socket.io server to pipe changes to client')
  .parse(process.argv);

program.output = program.output || "./Resources/timplate/";
program.templates = program.templates || "./templates";
program.stylesheets = program.stylesheets || "./stylesheets";

// Handlers for processing template files
var templateHandlers = {
  jade: function (data, filename) {
    return {
      fn: jade.compile(data, {filename: filename, client: true}).toString(),
      type: "jade"
    };
  },

  ejs: function (data, filename) {
    return {
      fn: ejs.compile(data, {filename: filename, client: true}).toString(),
      type: "ejs"
    };
  },

  handlebars: function (data, filename) {
    return {
      fn: "Handlebars.template(" + handlebars.precompile(data).toString() + ")", 
      type: "handlebars"
    };
  },

  eco: function (data, filename) {
    return {
      fn: eco.precompile(data),
      type: "eco"
    };
  }
};

function parseTemplates(templatesDir, outputDir, done) {
  var templates = {};
  walk(templatesDir).on("file", function (root, stat, next) {
    var ext = stat.name.split('.').pop();
    var fullpath = path.join(root, stat.name);

    fs.readFile(fullpath, 'utf8', function (err, data) {
      if (err) return next(err);
      var filename = fullpath.replace('templates/', '');
      var template = templateHandlers[ext](data, filename);

      var basename = filename.replace('.' + ext, '');
      templates[basename] = template;
      next();
    });
  }).on('end', function () {

    var file;
    var templateLines = [];
    for (file in templates) {
      templateLines.push('"' + file + '":' + templates[file].fn);
    }

    var typeLines = [];
    for (file in templates) {
      typeLines.push('"' + file + '":"' + templates[file].type + '"');
    }

    var buf = "(function(){" +
      "var jade = require('/timplate/jade-runtime'); " +
      "var Handlebars = require('/timplate/handlebars.runtime'); " +
      "exports.types = {" + typeLines.join(",") + "}; " +
      "exports.fns = {" + templateLines.join(",") + "}}());";
    fs.writeFile(path.join(outputDir, "templates.js"), buf, done);
  });
}

function parseStylesheets(stylesheetsDir, done) {
  // ids, classes and types are trees. We 'walk' selectors down the trees to
  // resolve them. We don't support descendent selectors or inheritance.

  var styleData = {};

  walk(stylesheetsDir).on("file", function (root, stat, next) {
    var ext = stat.name.split('.').pop();
    var fullpath = path.join(root, stat.name);

    fs.readFile(fullpath, 'utf8', function (err, data) {
      if (err) return next(err);
      var filename = fullpath.replace('stylesheets/', '');
      processCSS(data, filename, ext, styleData, next);
    });
  }).on("end", function () {
    var src = "module.exports = " + tosource(styleData) + ";";
    done(null, src, tosource(styleData), _.size(styleData));
  });
}

parseTemplates(program.templates, program.output);

parseStylesheets(program.stylesheets, function (err, data) {
  if (err) return console.log(err);

  var out = path.join(program.output, "styles.js");
  fs.writeFile(out, data);
});

module.exports.parseStylesheets = parseStylesheets;

if (program.watch) {
  var io = require('socket.io').listen(3456, {log: false});
  var clients = {};

  io.sockets.on('connection', function (socket) {
    var id;

    socket.on('register', function (data) {
      id = data.id;
      clients[data.id] = data;
      console.log("Connect: " + data.osname + " " + data.model + ", id: " + data.id);
    });

    socket.on('disconnect', function () {
      data = clients[id];
      if (!data) return;
      console.log("Disconnect: " + data.osname + " " + data.model + ", id: " + data.id);
      delete clients[id];
    });
  });

  fs.watch(program.stylesheets, function (event) {
    parseStylesheets(program.stylesheets, function (err, data, rawSrc, size) {
      if (err) return console.log(err);

      if (size === 0) return;

      var out = path.join(program.output, "styles.js");
      fs.writeFile(out, data);

      //console.log("Updating styles");
      io.sockets.emit('styles', rawSrc);
    });
  });
}

