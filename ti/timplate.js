module.exports = (function() {
  var TemplateWrapper = require('timplate/templater');
  var styler = require('timplate/styler');
  var proxy = require('timplate/proxy');
  var props = require('timplate/props');

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
  
  // List of wrappers to update when we receive updates over socket.io
  var wrappers = [];

  // Connect for live reload
  function connect (host) {
    var io = require('timplate/socket.io');
    var socket = io.connect(host || "localhost:3456");

    timplate.updates = true;

    socket.on('styles', function (styles) {
      /*jshint evil:true */
      console.log("Received stylesheet update");
      try {
        stylesheets = eval('(' + styles + ')');
        styler.clearResolveMemo();
        //garbageCollectWrappers();

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
      /* disabled for now
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
      */
    });

    socket.on('connect', function () {
      console.log("connected");
      alert('connected');
      socket.emit('register', {
        id: Ti.Platform.id,
        osname: Ti.Platform.osname,
        model: Ti.Platform.model
      });
    });

    socket.on('connect_failed', function (event) {
      console.log("connected failed");
      alert('websocket connection failed');
    });

    socket.on('error', function (event) {
      alert(event);
      console.log("error", event);
    });
  }

  function garbageCollectWrappers () {
    for (var i = wrappers.length - 1; i !== 0; i--) {
      var wrapper = wrappers[i];

      // TODO: find a way of removing wrappers here when we no longer need to
      // update them

      if (wrapper && wrapper._done) {
        wrappers.splice(i, 1);
      }
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
            wrapper.tree.onCloseHandler = onCloseHandler;
          });
        }
      }

      return wrapper;
    };
  }

  // Put constructors for all of the proxies on the main timplate object
  Object.keys(proxy.proxyTypes).forEach(function (type) {

    // Constructors can be called like
    //   timplate.Window('#id');
    //   timplate.Window({prop: 'val', style: '#id'});
    //   timplate.Window('#id', {prop: 'val'});
    //   timplate.Window('#id', children);
    // etc

    timplate[type] = function () {
      var style;
      var attrs = {};
      var children = [];
      var params; // support for old tylus-style params

      if (typeof arguments[0] == "string") style = arguments[0];
      else if (typeof arguments[0] == "object") attrs = arguments[0];

      if (typeof arguments[1] == "object") attrs = arguments[1];
      else if (Array.isArray(arguments[1])) children = arguments[1];

      if (Array.isArray(arguments[2])) children = arguments[2];

      if (typeof arguments[1] == "object" && typeof arguments[2] == "object")
        params = arguments[2];

      var computedStyles = timplate.getProps(type, attrs, style, params);

      return proxy.make(type, computedStyles, children, "dunno", null);
    };
  });

  timplate.getProps = function (type, attrs, style, params) {
    // If style isn't already set, try to get it out of the attrs
    if (!style) {
      if (attrs.tyle) style = attrs.tyle;
      else if (attrs.s) style = attrs.s;
      else if (attrs.styl) style = attrs.styl;
      else if (attrs.style) { style = attrs.style; delete attrs.style; }
    }

    // If arg 2 is a string, assume its a style string
    if (typeof attrs == "string") style = attrs;

    // If we ended up getting a style string, we need to parse it into parts;
    // ie, id, classes
    if (typeof style == "string") {
      var parts = style.split('.');

      for (var i = parts.length - 1; i >= 0; i--) 
        if (!parts[i]) parts.splice(i, 1);

      if (parts[0][0] == "#") {
        attrs.id = styler.strip(parts.shift().slice(1));
      }

      attrs['class'] = parts.map(function (item) { return styler.strip(item); }).join(' ');
    }

    // We respect a 'class' param, not 'className'
    if (attrs.className) attrs['class'] = attrs.className;

    if (!params) params = attrs; // try using attrs to satisfy template

    var styles = styler.resolve(stylesheets, props, type, attrs, params);

    var computedStyles = {};

    styler.defaultApply(computedStyles, attrs);
    styler.defaultApply(computedStyles, styles);

    return computedStyles;
  };

  timplate.connect = connect;

  timplate.setProperty = function (prop, val) {
    props[prop] = val;
  };

  return timplate;
}());
