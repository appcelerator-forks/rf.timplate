module.exports = (function() {
  var templater = require('timplate/templater');

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
      var ret = new EventEmitter();
      ret.view = templater.create(stylesheets, doc.firstChild, ret, handler);

      return ret;
    };
  }

  return timplate;
}());
