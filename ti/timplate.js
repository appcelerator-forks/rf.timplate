module.exports = (function() {
  var TemplateWrapper = require('timplate/templater');
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

      var wrapper = new TemplateWrapper(template, type, stylesheets);
      wrapper.update(locals);

      if (timplate.updates) {
        var onStylesUpdate = function () {
          wrapper.stylesheets = stylesheets;
          wrapper.updateAllStyles();
        };

        timplate.updates.on('styles', onStylesUpdate);

        var remover = function () {
          wrapper.tree.view.removeEventListener('close', remover);
          timplate.updates.off('styles', onStylesUpdate);
        };

        if (wrapper.tree.type == "Window") 
          wrapper.tree.view.addEventListener('close', remover);
      }

      return wrapper;
    };
  }

  timplate.connect = connect;

  return timplate;
}());
