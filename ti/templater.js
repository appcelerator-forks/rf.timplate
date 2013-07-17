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
  self.events = {};

  self.tree = {children: [], attributes: {}};
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

  Object.keys(self.events).forEach(function (name) {
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

  // TODO: correct remove / readd logic for other types of proxies

  // already constructed once, we need to remove and reconstruct then readd
  if (self.tree.view) {
    self.parent = self.tree.view.parent;
    if (self.parent) self.parent.remove(self.tree.view);
    else if (self.tree.type != "Section") {
      self.parent = "window";
      try { 
        self.tree.view.removeEventListener(self.tree.onCloseHandler); 
      } catch (e) { /* handler already removed */ }
      self.tree.view.close();
    }

    self.tree.children = [];
  }

  self.getXML(locals);
  self.create(self.doc, "top", self.tree);

  // there's a parent reference so we need to re-add the view or re-open the win
  if (self.parent) {
    if (self.parent == "window") {
      self.tree.view.open();
      self._ignoreClose = false;
      console.log("opened win");
    } else {
      if (self.tree.type == "Section") self.parent.sections = [self.tree.view];
      else self.parent.add(self.tree.view);
    }
  }
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
    view.type, 
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

  if (goodNodeType(sourceNode) == "string") return sourceNode.nodeValue;
  // Populates `attributes` and `events` objects.
  handleAttributes(sourceNode.attributes, attributes, events);

  // Copy the base attributes into the tree node. We do this so we can apply
  // styling changes to the base attributes if we are live reloading styles.
  styler.defaultApply(newTreeNode.attributes, attributes);
  newTreeNode.type = type;

  var styles = styler.resolve(self.stylesheets, props, type, attributes);
  styler.defaultApply(attributes, styles);

  // we will put children of the current node here. they are handled
  // appropriately by the code in proxy.js
  var children = [];
  // If the node contains text, we put it in here
  var textValue = "";
  var childNodes = sourceNode.childNodes;
  var len = childNodes.length;

  for (iter = 0; iter < len; iter++) {
    var newTreeChildNode = {children: [], attributes: {}};

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
      if (newChild) textValue += newChild;
    }

    else {
      newTreeNode.children.push(newTreeChildNode);
      children.push(newChild);
    }
  }

  // Actually make the damn thing, see `proxy.js` to see how we do that
  var item = proxy.make(type, attributes, children, parentType, textValue);

  // add a reference to the item onto self
  if (attributes.id) self[attributes.id] = item;

  // add a reference to the newly created view on the new tree node
  newTreeNode.view = item;

  newTreeNode.events = self.handleEvents(item, type, events);

  return item;
};

// ## handleEvents
// Handles the events for a particular item

TemplateWrapper.prototype.handleEvents = function (item, type, events) {
  var self = this;

  var eventMap = Object.keys(events).reduce(function (memo, name) {
    memo[name] = function (event) {
      try { self.emit(events[name], event, item); } 
      catch (e) {
        console.log('Unhandled exception in ' + name + ' handler for ' + type);
        Ti.App.fireEvent('unhandledException', {
          event: name,
          type: type,
          exception: e
        });
      }
    };
    return memo;
  }, {});

  if (type == "Template") item.events = eventMap;
  else Object.keys(eventMap).forEach(function (name) {
    item.addEventListener(name, eventMap[name]);
  });

  // We maintain a list of events for the TemplateWrapper#forward function
  for (var ii in events) self.events[events[ii]] = true;

  return eventMap;
};

module.exports = TemplateWrapper;

}());
