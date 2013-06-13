// # creates a tokenizer
// A tokenizer
function tokenizer (tokens) {
  var matcherSources = [];
  var types = [];

  // Build a big regexp that checks for each possible token in a single pass
  for (var type in tokens) {
    types.push(type);
    matcherSources.push("(" + tokens[type] + ")");
  }

  var matcher = new RegExp(matcherSources.join("|"));

  return function (string) {
    var match = matcher.exec(string);
    if (match) {
      for (var ii = 1; ii < match.length; ii++) {
        if (match[ii]) return {
          type: types[ii - 1],
          str: match[ii]
        };
      }
    }
    
    return false;
  };
}

module.exports = tokenizer;
