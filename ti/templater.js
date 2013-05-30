(function () {

var styler = require('timplate/styler');
var maps = require('timplate/maps');
var props = require('timplate/props');

function make (type, args) {
  if (type in maps.types) return Ti.UI['create' + maps.types[type]](args);
  else return new maps.constructors[type](args);
}

// ## goodNodeType
// Returns node type in an easier to use way

function goodNodeType (node) {
  var n = node.nodeType;
  if (n == node.TEXT_NODE) return "string";
  if (n == node.ENTITY_NODE) return "entity";
  if (n == node.CDATA_SECTION_NODE) return "string";
  if (n == node.ATTRIBUTE_NODE) return "attribute";
  if (n == node.ELEMENT_NODE) return "element";
}

// ## handleAttributes
// Converts attributes on an xml node into an object of attributes and
// events

function handleAttributes (xmlAttributes, /*out*/ attributes, /*out*/ events) {
  // Put attributes into an obj
  if (xmlAttributes) {
    var numAttrs = xmlAttributes.length;
    for (var iter = 0; iter < numAttrs; iter++) {
      var attr = xmlAttributes.item(iter);
      attributes[attr.nodeName] = attr.nodeValue;

      // assume it's an event. If it's not we'll just end up adding a
      // listener for an event that doesn't exist, little penalty there.
      if (attr.nodeName.indexOf("on") === 0) {
        var correctedName = attr.nodeName.slice(2, 3).toLowerCase() +
          attr.nodeName.slice(3);
        events[correctedName] = attr.nodeValue;
      }
    }
  }
}

// ## create
// Recursively creates elements based on the XML tree.  Returns top level view.
// Events are handled in 2 ways - we fire an event on `emitter` and we check
// to see if there is a function to be called on `handler`.
//
//  * `node` the current node we're at in the tree
//  * `emitter` the emitter we're firing events on
//  * `handler` the object with methods that will handle events
//  * `parentType` type of the parent of the current node

function create (stylesheets, node, emitter, handler, parentType) {
  var iter;
  var type = node.nodeName;
  var nodeType = node.nodeType;
  var attributes = {};
  var events = {};

  if (goodNodeType(node) == "string") return node.nodeValue;
  handleAttributes(node.attributes, attributes, events);

  // If the child is a text node, use it as the text or title property of the
  // new element. Edge case. We do this here instead of in the lower child
  // processing loop because this way we set the attribute before creating
  // the element.
  if (node.firstChild) {
    var child = node.firstChild, val = child.nodeValue;
    if (goodNodeType(child) == "string") {
      if (type == "Label") attributes.text = val;
      else attributes.title = val;
    }
  }


  var styles = styler.resolve(stylesheets, props, type, attributes);
  styler.defaultApply(attributes, styles);

  if (type == "View" || type == "Label")
  console.log(type, "styles:", styles);

  var item;
  if (parentType == "Template") {
    // In template mode we need to output a template fragment instead of an
    // actual view.
    item = {
      properties: attributes,
      template: attributes.template,
      bindId: attributes.bindId,
      type: 'Ti.UI.' + maps.types[type]
    };
  } else if (parentType == "Item") {
    // If the parent is an item, this needs to just be an object
    item = attributes;
    item.name = type;
  } else if (type != "List") {
    // We have to defer list creation to when we've collected all templates
    item = make(type, attributes);
  }

  // For storing section items or list items when iterating over children
  var listItems = [];

  var children = node.childNodes;
  var len = children.length;

  for (iter = 0; iter < len; iter++) {
    // We pass our type to the next call down since if we're a Template, the
    // child has to do weird edge case stuff. Also, if our parent was a 
    // Template, we need to continue doing weird edge case stuff, so we pass
    // "Template" as the parentType again.
    var newChild = create(
      stylesheets,
      children.item(iter), 
      emitter, 
      handler, 
      parentType == "Template"? "Template" : type
    );

    if (typeof newChild == "string") continue; // ignore text / cdata nodes

    if (type == "Template" || parentType == "Template") {
      // current type is template, so the new child is a view to be added
      // to the array. Or its a child of a child of a template, so we have
      // nested templates
      item.childTemplates = item.childTemplates || [];
      item.childTemplates.push(newChild);
    } else if (type == "List") {
      if (newChild.childTemplates) {
        attributes.templates = attributes.templates || {};
        attributes.templates[newChild.name] = newChild;
      } else listItems.push(newChild);
    } else if (type == "Section") {
      listItems.push(newChild);
    } else if (type == "Item") {
      item[newChild.name] = newChild;
    } else {
      item.add(newChild);
    }
  }

  if (type == "Template") {
    // Edge case of template event handlers
    Object.keys(events).forEach(function (iter) {
      var name = events[iter];
      events[iter] = function (event) {
        emitter.emit(name, event);
        var correctedName = 'on' + name.slice(0, 1).toUpperCase() + name.slice(1);

        if (typeof handler[correctedName] == "function")
          handler[correctedName].call(handler, event);
        if (typeof handler[name] == "function")
          handler[name].call(handler, event);
      };
    });
    attributes.events = events;
  }

  if (type == "List") {
    // List creation is deferred until this point so we can construct w/
    // the sections
    attributes.sections = listItems;
    item = make(type, attributes);
  } else if (type == "Section") {
    item.setItems(listItems);
  }

  // Handle events
  if (attributes.id && !emitter.hasOwnProperty(attributes.id))
    emitter[attributes.id] = item;

  if (type != "Template") {
    Object.keys(events).forEach(function (eventName) {
      item.addEventListener(eventName, function (event) {
        emitter.emit(events[eventName], event);
      });

      if (handler) {
        // Check if the handler obj has onHandlerName
        var name = events[eventName];
        var correctedName = 'on' + name.slice(0, 1).toUpperCase() + name.slice(1);
        if (typeof handler[correctedName] == "function")
          item.addEventListener(eventName, function (event) {
            handler[correctedName].call(handler, event);
          });

        // Check if handler obj has handlerName
        if (typeof handler[name] == "function")
          item.addEventListener(eventName, function (event) {
            handler[name].call(handler, event);
          });
      }
    });
  }

  return item;
}

exports.goodNodeType = goodNodeType;
exports.create = create;

}());
