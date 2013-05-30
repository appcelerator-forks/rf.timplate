(function () {

// ## defaultApply
// Does a default-apply into dest from src
function defaultApply (dest, src) {
  for (var iter in src)
    if (src.hasOwnProperty(iter) && !dest.hasOwnProperty(iter))
      dest[iter] = src[iter];
}

// ## apply
// applies into dest from src
function apply (dest, src) {
  for (var iter in src)
    if (src.hasOwnProperty(iter))
      dest[iter] = src[iter];
}

// ## strip
// strips whitespace from string
function strip (str) {
  return str.split(' ').reduce(function (memo, item) {
    if (item) memo += item;
    return memo;
  }, "");
}

// ## resolveMedia
// Resolves media queries

function resolveMedia (node, properties) {
  node.$media.forEach(function (media) {
    if (media.query(properties)) apply(node.$styles, media.styles);
  });
}

// ## resolveSubtree
// Recursively resolves styles while walking down a tree of styles
function resolveSubtree (subtree, out, selectors) {
  var selector = selectors.shift();

  (Array.isArray(selector)? selector : [selector]).forEach(function (iter) {
    var newSubtree = subtree[iter];
    resolveMedia(newSubtree);
    defaultApply(out, newSubtree.$styles);

    resolveSubtree(newSubtree, out, selectors);
  });
}

// ## buildSelectorList
// Builds a list of lists of selectors based on a type and set of attributes. 
// Return will look like this:
// [
//   ['Label', '#foosomeId', ['.class', '.names']],
//   ['Label', ['.class', '.names']],
//   ['#foosomeId', ['.class', '.names']],
//   [['.class', '.names']]
// ]

function buildSelectorList (type, attributes) {
  // Full is the 'full selector', containing type, id, and classes
  var full = [type];
  var classes;
  var ret = [full];

  // Add the id to the full selector
  if (attributes.id) full.push('#' + attributes.id);

  if (attributes['class']) {
    classes = attributes['class'].split(' ').map(function (iter) {
      return '.' + strip(iter);
    });
    // Add the classes to the full selector
    full.push(classes);

    // if there's an id, we need a separate [type, classes] selector. Otherwise
    // the full selector will be just [type, classes] since there's no id.
    if (attributes.id) ret.push([type, classes]);

    // Add the bare classes selector
    ret.push([classes]);
  }

  if (attributes.id && attributes['class'])
    ret.push(['#' + attributes.id, classes]);

  return ret;
}

function resolve (stylesheets, type, attributes) {
  var selectorList = buildSelectorList(type, attributes);
  var out = {};

  selectorList.forEach(function (iter) {
    resolveSubtree(stylesheets, out, iter.concat());
  });

  return out;
}

exports.resolve = resolve;
exports.buildSelectorList = buildSelectorList;
exports.defaultApply = defaultApply;
exports.strip = strip;
exports.resolveMedia = resolveMedia;

}());
