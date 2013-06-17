module.exports = (function() {
  var templater = require('timplate/templater');
  var styler = require('timplate/styler');

  var templates;
  try {
    templates = require('timplate/templates');
  } catch (e) {
    console.log("timplate: no templates found");
    return;
  }

  var stylesheets;
  try {
    stylesheets = require('timplate/styles');
  } catch (e) {
    console.log("timplate: no stylesheets found");
    return;
  }

  var EventEmitter = require('timplate/eventemitter2').EventEmitter2;

  // Connect for live reload
  function connect (host) {
    var io = require('timplate/socket.io');
    var socket = io.connect(host || "localhost:3456");

    timplate.updates = new EventEmitter();

    socket.on('styles', function (styles) {
      /*jshint evil:true */
      console.log("Received stylesheet update");
      try {
        stylesheets = eval('(' + styles + ')');
        styler.clearResolveMemo();
        timplate.updates.emit('styles');
      } catch (e) {
        console.log('Error receiving styles');
        console.log(e);
      }
    });

    socket.on('templates', function (newTemplates) {
      /*jshint evil:true */
      console.log("Recevied template update");

      try {
        var jade = require('/timplate/jade-runtime');
        var Handlebars = require('/timplate/handlebars.runtime'); 
        templates = eval(newTemplates);
        timplate.updates.emit('templates');
      }

      catch (e) {
        console.log("Error receiving template update");
        console.log(e);
      }
    });

    socket.on('connect', function () {
      console.log("connected");
      socket.emit('register', {
        id: Ti.Platform.id,
        osname: Ti.Platform.osname,
        model: Ti.Platform.model
      });
    });

    socket.on('connect_failed', function (event) {
      console.log("connected failed");
    });

    socket.on('error', function (event) {
      console.log("error", event);
    });
  }

  function timplate (name) {
    if (typeof templates.fns[name] == 'undefined') {
      throw new Error("template " + name + " not found");
    }

    return function (locals, handler) {
      var template = templates.fns[name], type = templates.types[name];

      var xml = template(locals);

      // Wrap the whole thing in a Timplate tag if it isn't already. The root
      // element can't have attributes, but we want to allow it to have
      // attributes. This is hacky.
      if (xml.indexOf("<Timplate>") !== 0) {
        xml = "<Timplate>" + xml + "</Timplate>";
      }

      var doc = Ti.XML.parseString(xml);
      if (Ti.Platform.osname == "android") doc = doc.firstChild;

      var ret = new EventEmitter();
      ret.view = templater.create(stylesheets, doc.firstChild, ret, handler);

      if (timplate.updates) {
        var onStylesUpdate = function () {
          templater.updateAllStyles(stylesheets, ret.tree);
        };

        timplate.updates.on('styles', onStylesUpdate);

        var remover = function () {
          ret.tree.view.removeEventListener('close', remover);
          timplate.updates.off('styles', onStylesUpdate);
        };

        if (ret.tree.type == "Window") 
          ret.tree.view.addEventListener('close', remover);
      }

      return ret;
    };
  }

  timplate.connect = connect;

  return timplate;
}());
