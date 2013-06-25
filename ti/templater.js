(function () {

var styler = require('timplate/styler');
var props = require('timplate/props');
var EventEmitter = require('timplate/eventemitter2').EventEmitter2;

var proxy = require('timplate/proxy');

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

  // we will put children of the current node here
  var children = [];

  var childNodes = sourceNode.childNodes;
  var len = childNodes.length;

  for (iter = 0; iter < len; iter++) {
    var newTreeChildNode = {children: []};

    // We pass our type to the next call down since if we're a Template, the
    // child has to do weird edge case stuff. Also, if our parent was a 
    // Template, we need to continue doing weird edge case stuff, so we pass
    // "Template" as the parentType again.
    var newChild = self.create(
      childNodes.item(iter), 
      parentType == "Template"? "Template" : type,
      newTreeChildNode
    );

    if (typeof newChild == "string") {
      console.log("newChild:", newChild);
      continue; // ignore text / cdata nodes
    }

    newTreeNode.children.push(newTreeChildNode);
    children.push(newChild);
  }

  var item = proxy.make(type, attributes, children, parentType);

  // add a reference to the item onto self
  if (attributes.id && !self.hasOwnProperty(attributes.id))
    self[attributes.id] = item;

  // add a reference to the newly created view on the new tree node
  newTreeNode.view = item;
  newTreeNode.type = type;

  // Keep track of events so we can remove them later
  newTreeNode.events = Object.keys(events);

  self.handleEvents(item, type, events);

  for (var ii in events) self.events.push(events[ii]);

  return item;
};

// ## handleEvents
// Handles the events for a particular item

TemplateWrapper.prototype.handleEvents = function (item, type, events) {
  var self = this;

  // Template events must be handled before the list is created
  if (type == "Template") {
    item.events = Object.keys(events).reduce(function (memo, name) {
      memo[name] = function (event) {
        self.emit(events[name], event);
      };
      return memo;
    }, {});
  }

  // Regular events have to be handled after the item is created
  if (type != "Template") {
    Object.keys(events).forEach(function (eventName) {
      item.addEventListener(eventName, function (event) {
        self.emit(events[eventName], event);
      });
    });
  }
};

module.exports = TemplateWrapper;

}());
