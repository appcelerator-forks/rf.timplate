(function () {

var proxyTypes = {
  Matrix2D    : '2DMatrix',
  Matrix3D    : '3DMatrix',
  Indicator   : 'ActivityIndicator',
  AlertDialog : 'AlertDialog',
  Animation   : 'Animation',
  Button      : 'Button',
  ButtonBar   : 'ButtonBar',
  CoverFlow   : 'CoverFlow',
  DashItem    : 'DashboardItem',
  Dash        : 'DashboardView',
  EmailDialog : 'EmailDialog',
  Image       : 'ImageView',
  OptionDialog: 'OptionDialog',
  Label       : 'Label',
  Picker      : 'Picker',
  PickerRow   : 'PickerRow',
  PickerCol   : 'PickerColumn',
  ProgressBar : 'ProgressBar',
  Scroll      : 'ScrollView',
  Scrollable  : 'ScrollableView',
  SearchBar   : 'SearchBar',
  Slider      : 'Slider',
  Switch      : 'Switch',
  Tab         : 'Tab', 
  TabGroup    : 'TabGroup',
  TabbedBar   : 'TabbedBar',
  Table       : 'TableView',
  TableRow    : 'TableViewRow',
  TableSection: 'TableViewSection',
  TextArea    : 'TextArea',
  TextField   : 'TextField',
  Toolbar     : 'Toolbar',
  View        : 'View',
  Web         : 'WebView',
  Window      : 'Window',
  List        : 'ListView',
  Section     : 'ListSection'
};

var constructors = {
  Object      : Object,
  Template    : Object,
  Item        : Object
};

var ctors = {};

ctors.Object = function (type, attributes, children, parentType) {
  var ret = {};
  ret.type = type;
  for (var ii in attributes) ret[ii] = attributes[ii];
  ret.children = children;
};

ctors.Item = ctors.Object;

ctors.Template = function (type, attributes, children, parentType) {

};

var ios = Ti.Platform.osname !== "android";

function makeProxy (type, attributes, children, parentType, textValue) {
  if (type == "List") {
    // List creation is deferred until this point so we can construct w/
    // the sections
    attributes.templates = {};
    attributes.sections = [];
    children.forEach(function (item) {
      if (item.childTemplates) attributes.templates[item.name] = item;
      else attributes.sections.push(item);
    });
    if (attributes.sections.length === 0) delete attributes.sections;
  }

  else if (type == "Table") {
    attributes.data = children;
  }

  else if (type == "TableSection" && ios) {
    // on ios we can just set attributes.rows; on android we have to add the
    // rows below
    attributes.rows = children;
  }

  if (textValue) {
    if (type == "Label") attributes.text = textValue;
    else attributes.title = textValue;
  }

  var proxy = Ti.UI['create' + proxyTypes[type]](attributes);

  if (type == "Section") {
    proxy.setItems(children);
  } else if (type == "TableSection") {
    if (!ios) children.forEach(function (child) { proxy.add(child); });
  } else if (type != "Table" && type != "List" && children.length) {
    // iOS `View#add` method can take an array, android add method cannot
    if (ios) proxy.add(children);
    else children.forEach(function (child) { proxy.add(child); });
  }

  proxy.on = function (eventName, handler) {
    proxy.addEventListener(eventName, function (event) {
      try { handler(event, proxy); }
      catch (e) {
        Ti.App.fireEvent('unhandledException', {
          event: eventName,
          type: type,
          exception: e
        });
      }
    });
  };

  return proxy;
}

function make (type, attributes, children, parentType, textValue) {
  if (parentType == "Template") {
    // In 'template mode' we need to output a template fragment instead of an
    // actual view.
    var ret = {
      properties: attributes,
      template: attributes.template,
      bindId: attributes.bindId,
      type: 'Ti.UI.' + proxyTypes[type],
      childTemplates: children.length? children : undefined
    };
    delete attributes.template;
    return ret;
  } 

  // If the parent is an item, this needs to just be an object
  if (parentType == "Item") {
    attributes.name = attributes.name || type;
    return attributes;
  }

  // At this point, if its a view proxy type, we can create it
  if (type in proxyTypes) return makeProxy.apply(null, arguments); 

  // If its a template we just need to set the childTemplates property
  if (type == "Template") {
    return {
      childTemplates: children,
      name: attributes.name
    };
  }

  // Items consist of key value pairs
  if (type == "Item") {
    return children.reduce(function (memo, prop) { 
      memo[prop.name] = prop; 
      return memo;
    }, attributes);
  }
}

exports.make = make;

}());
