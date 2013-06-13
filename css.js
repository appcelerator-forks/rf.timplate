var stylus = require('stylus');
var cssom = require('cssom');
var _ = require('lodash');
var tokenizer = require('./tokenizer');

// These properties are objects when passed to the factory functions, so we
// have to fix them in the css. They're specified in css as objname-propname,
// for example font-fontSize center-x center-y etc.
var objProps = [
   'font', 
   'backgroundGradient',
   'center', 
   'anchorPoint', 
   'animatedCenterPoint',
   'shadowOffset',
   'size',
   'transform'
];

// Handlers for processing style files
var stylesheetHandlers = {
  styl: function (data, filename, done) {
    stylus.render(data, {filename:filename}, function (err, data) {
      if (err) throw err;
      done(data);
    });
  },

  css: function (data, filename, done) { done(data); }
};

// css object format -> hash
function processStyles (styles) {
  var out = {}, wasObjProp;
  for (var i = 0; i < styles.length; i++) {
    wasObjProp = false;
    for (var jj in objProps) {
      jj = objProps[jj];
      // it's an object property
      if (styles[i].indexOf(jj) === 0) {
        out[jj] = out[jj] || {};
        var propName = styles[i].slice(jj.length + 1);
        out[jj][propName] = styles[styles[i]];
        wasObjProp = true;
      }
    }

    if (!wasObjProp) out[styles[i]] = styles[styles[i]];
  }
  return out;
}

function processCSSRules (cssRules, styleData, media) {
  cssRules.forEach(function (item) {
    var sels, styles;

    // Process selectors
    if (item.selectorText) sels = getSelectors(item.selectorText);

    if (item.media && media) throw new Error("cannot nest media queries");

    // Process media queries. If there's a media query, we found it in the root
    // (the only valid place for a media query) so we need to recurse and
    // parse the contents of the media query as
    if (item.media)
      processCSSRules(item.cssRules, styleData, processMedia(item.media));

    if (item.style) styles = processStyles(item.style);

    // Insert styles into tree
    if (sels) sels.forEach(function (sel) {
      var dest = styleData;

      sel.forEach(function (item) {
        dest[item] = dest[item] || {};
        dest = dest[item];
      });

      // If we're within a media query, dest.$media[n].query will be the
      // function to decide the query and dest.$media[n].styles will be the
      // styles applied if the function succeeds
      if (media) {
        dest.$media = dest.$media || [];
        dest.$media.push({
          query: media,
          styles: styles
        });
      } else {
        dest.$styles = dest.$styles || {};
        _.defaults(dest.$styles, styles);
      }
    });
  });
}

function getSelectors (selector) {
  var processed = processSelector(selector);
  var all = [];

  processed.forEach(function (item) {
    var ret = [];
    if (item.type) ret.push(item.type);
    if (item.id) ret.push('#' + item.id);
    if (item.classes) ret.push('.' + item.classes.join('.'));
    all.push(ret);
  });

  return all;
}

// ## processSelector
// Parses a selector into an array of objects with type, id, classes properties.

var selectorTokenizer;

function processSelector (selector) {
  var output = [{}];
  var currOutput = output[0];
  var lastType = "start";

  if (!selectorTokenizer) selectorTokenizer = tokenizer({
    type: "^[a-zA-Z\\-]+",
    id: "^\\#[a-zA-Z\\-]+",
    'class': "^\\.[a-zA-Z\\-]+",
    space: "^ ",
    child: "^ *> *",
    sibling: "^ *\\+ *",
    or: "^, *"
  });

  while (selector.length > 0) {
    var match = selectorTokenizer(selector);
    if (!match) break;

    switch (match.type) {
      case "type":
        currOutput.type = match.str;
      break;

      case "id":
        currOutput.id = match.str.slice(1);
      break;

      case "class":
        currOutput.classes = currOutput.classes || [];
        currOutput.classes.push(match.str.slice(1));
      break;

      case "or":
        currOutput = {};
        output.push(currOutput);
      break;

      case "space": 
      case "child":
      case "sibling":
        throw new Error("Combinators not supported");
    }

    selector = selector.slice(match.str.length);
    lastType = match.type;
  }

  if (output.classes) output.classes.sort();
  return output;
}

function processMedia (media) {
  media = "(" + [].join.call(media, ') || (') + ")";
  var code = "(function (props) { with (props) { return " +
    media.replace(/: ?([\w]*)/g, ' === "$1"').replace(/ and /ig, " && ") +
    "; }; })";

  // We eval here so that we can easily call tosource() on the resulting styles
  // object later and get a properly formatted function. We want the function
  // to be parsed when the file is require()d in Titanium land, otherwise we'd
  // have to eval() it in the app, which is wasteful.
  return eval(code);
}

// ## compileQuery
// Compiles a query to a javascript function. This function will take a
// single argument, a hash of properties to be used in the evaluation of the
// query. The query supports and, or, and ().

var queryTokenizer;

function compileQuery (query) {
  query = query.slice(1); // slice off the $
  var fn = "(function query (locals) { with (locals) { return ";

  if (!queryTokenizer) {
    queryTokenizer = tokenizer({
      ident: "^[a-zA-Z\\-]+",
      and: "^ ?and ",
      or: "^ ?or ",
      openParen: "^\\(",
      closeParen: "^\\)"
    });
  }

  while (query.length > 0) {
    var match = queryTokenizer(query);
    if (!match) break;
    switch (match.type) {
      case "and": fn += " && "; break;
      case "or":  fn += " || "; break;

      default: fn += match.str; break;
    }
    query = query.slice(match.str.length);
  }

  fn += "; } });";

  return eval(fn);
}

function processCSS (data, filename, ext, output, done) {
  stylesheetHandlers[ext](data, filename, function (css) {
    var basename = filename.replace('.' + ext, '');
    var parsed = cssom.parse(css);
    processCSSRules(parsed.cssRules, output);
    done();
  });
}

module.exports = processCSS;

module.exports.processSelector = processSelector;
module.exports.compileQuery = compileQuery;
module.exports.processCSSRules = processCSSRules;
module.exports.processMedia = processMedia;
