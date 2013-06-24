(function () {

var styler = require('timplate/styler');
var maps = require('timplate/maps');
var props = require('timplate/props');
var EventEmitter = require('timplate/eventemitter2').EventEmitter2;

function TemplateWrapper (fn, type, stylesheets) {
  var self = this;

  EventEmitter.call(this);

  self.fn = fn;
  self.type = type;
  self.stylesheets = stylesheets;
  self.events = [];

  self.tree = {children: []};
}

// Inherit from EventEmitter

TemplateWrapper.prototype = Object.create(EventEmitter.prototype, {
  constructor: {
    value: EventEmitter,
    enumerable: false,
    writable: true,
    configurable: true
  }
});

// ## forward
// Forwards all events to the given handler. We'll look for an onEvent or event
// method on handler, which will be called on the event.
TemplateWrapper.prototype.forward = function (handler) {
  var self = this;

  self.events.forEach(function (name) {
    var correctedName = "on" + name.slice(0, 1).toUpperCase() + name.slice(1);

    if (handler[correctedName]) self.on(name, function (event) {
      handler[correctedName](event);
    });

    if (handler[name]) self.on(name, function (event) {
      handler[name](event);
    });
  });
};

// ## update
// Re-runs the templater function and recreates any part of the layout that
// needs to be recreated.
TemplateWrapper.prototype.update = function (locals) {
  var self = this;

  self.getXML(locals);
  self.create(self.doc, "top", self.tree);
};

var ios = Ti.Platform.osname !== "android";

// ## getXML
// Gets compiled xml out of the template function using some set of locals
TemplateWrapper.prototype.getXML = function (locals) {
  var self = this;
  var xml = self.fn(locals);

  if (xml.indexOf("<Timplate>") !== 0) {
    xml = "<Timplate>" + xml + "</Timplate>";
  }

  var doc = Ti.XML.parseString(xml);
  doc = doc.firstChild;
  if (!ios) doc = doc.firstChild;

  self.doc = doc;

  return doc;
};

TemplateWrapper.prototype.updateStyles = function (view) {
  var self = this;

  var styles = styler.resolve(
    self.stylesheets, 
    props, 
    view.attributes.type, 
    view.attributes
  );

  if (view.view.applyProperties)
    view.view.applyProperties(styles);
  else
    for (var ii in styles) view.view[ii] = styles[ii];
};

TemplateWrapper.prototype.updateAllStyles = function (root) {
  var self = this;

  root = root || self.tree;

  self.updateStyles(root);

  for (var i = 0; i < root.children.length; i++) {
    self.updateAllStyles(root.children[i]);
  }
};

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
// Events are handled in 2 ways - we fire an event on `emitter`.
//
//  * `sourceNode` the current node we're at in the tree
//  * `parentType` type of the parent of the current node
//  * `newTreeNode` current node in the new view tree that we're building

TemplateWrapper.prototype.create = function (sourceNode, parentType, newTreeNode) {
  var self = this;
  var iter;
  var type = sourceNode.nodeName;
  var nodeType = sourceNode.nodeType;
  var attributes = {};
  var events = {};
  var topLevel = false;

  if (goodNodeType(sourceNode) == "string") return sourceNode.nodeValue;
  handleAttributes(sourceNode.attributes, attributes, events);

  // If the child is a text node, use it as the text or title property of the
  // new element. Edge case. We do this here instead of in the lower child
  // processing loop because this way we set the attribute before creating
  // the element.
  if (sourceNode.firstChild) {
    var child = sourceNode.firstChild, val = child.nodeValue;
    if (goodNodeType(child) == "string") {
      if (type == "Label") attributes.text = val;
      else attributes.title = val;
    }
  }

  // Copy the base attributes into the tree node. We do this so we can apply
  // styling changes to the base attributes.
  newTreeNode.attributes = {};
  styler.defaultApply(newTreeNode.attributes, attributes);
  newTreeNode.attributes.type = type;

  var styles = styler.resolve(self.stylesheets, props, type, attributes);
  styler.defaultApply(attributes, styles);

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
    delete attributes.template;
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

  var children = sourceNode.childNodes;
  var len = children.length;

  for (iter = 0; iter < len; iter++) {
    var newTreeChildNode = {children: []};

    // We pass our type to the next call down since if we're a Template, the
    // child has to do weird edge case stuff. Also, if our parent was a 
    // Template, we need to continue doing weird edge case stuff, so we pass
    // "Template" as the parentType again.
    var newChild = self.create(
      children.item(iter), 
      parentType == "Template"? "Template" : type,
      newTreeChildNode
    );

    if (typeof newChild == "string") continue; // ignore text / cdata nodes

    newTreeNode.children.push(newTreeChildNode);

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

  // Template events must be handled before the list is created
  if (type == "Template") {
    attributes.events = Object.keys(events).reduce(function (memo, name) {
      memo[name] = function (event) {
        self.emit(events[name], event);
      };
      return memo;
    }, {});
  }

  if (type == "List") {
    // List creation is deferred until this point so we can construct w/
    // the sections
    attributes.sections = listItems;
    item = make(type, attributes);
  } else if (type == "Section") {
    console.log(JSON.stringify(listItems[0]));
    item.setItems(listItems);
  }

  // add a reference to the item onto the emitter
  if (attributes.id && !self.hasOwnProperty(attributes.id))
    self[attributes.id] = item;

  // Regular events have to be handled after the item is created
  if (type != "Template") {
    Object.keys(events).forEach(function (eventName) {
      item.addEventListener(eventName, function (event) {
        self.emit(events[eventName], event);
      });
    });
  }

  // add a reference to the newly created view on the new tree node
  newTreeNode.view = item;
  newTreeNode.type = type;
  // Keep track of events so we can remove them later
  newTreeNode.events = Object.keys(events);

  for (var ii in events) self.events.push(events[ii]);

  return item;
};

module.exports = TemplateWrapper;

}());
