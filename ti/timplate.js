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
  var Spade;
  
  // List of wrappers to update when we receive updates over socket.io
  var wrappers = [];

  // Connect for live reload
  function connect (host) {
    var io = require('timplate/socket.io');
    var socket = io.connect(host || "localhost:3456");
    if (!Spade) Spade = require('org.russfrank.spade');

    timplate.updates = true;

    socket.on('styles', function (styles) {
      /*jshint evil:true */
      console.log("Received stylesheet update");
      try {
        stylesheets = eval('(' + styles + ')');
        styler.clearResolveMemo();
        garbageCollectWrappers();

        for (var w in wrappers) {
          var wrapper = wrappers[w];
          wrapper.stylesheets = stylesheets;
          wrapper.updateAllStyles();
        }

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

        garbageCollectWrappers();
        for (var w in wrappers) {
          var wrapper = wrappers[w];
          if (!templates.fns[wrapper._name]) return;
          wrapper.fn = templates.fns[wrapper._name];
          wrapper.update(wrapper._locals);
        }

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

  function garbageCollectWrappers () {
    for (var i = wrappers.length - 1; i !== 0; i--) {
      var wrapper = wrappers[i];

      // If a view is no longer visible, stop auto-updating it
      if (wrapper.tree.type != "Window" && !Spade.visible(wrapper.tree.view))
        wrappers.splice(i, 1);
    }
  }

  function timplate (name) {
    if (typeof templates.fns[name] == 'undefined') {
      throw new Error("template " + name + " not found");
    }

    return function (locals, handler) {
      var template = templates.fns[name], type = templates.types[name];

      var wrapper = new TemplateWrapper(template, type, stylesheets);
      wrapper.update(locals);
      wrapper._name = name;
      wrapper._locals = locals;

      if (timplate.updates) {
        wrappers.push(wrapper);
        
        if (wrapper.tree.type == "Window") {
          wrapper.tree.view.addEventListener('close', function onCloseHandler () {
            for (var i = wrappers.length - 1; i !== 0; i--) {
              var w = wrappers[i];
              if (w === wrapper) wrappers.splice(i, 1);
            }
            wrapper.tree.view.removeEventListener('close', onCloseHandler);
          });
        }
      }

      return wrapper;
    };
  }

  timplate.connect = connect;

  return timplate;
}());
