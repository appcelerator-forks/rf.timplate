// ## walk
// Walks an object and stringifies it. Does not handle circular references.
// Also handles Ti props.

function walk (object) {
  switch (typeof object) {
    case 'string':
      if (object.indexOf('Ti.') === 0 || object.indexOf('Titanium.') === 0)
        return object;

      return JSON.stringify(object);

    case 'boolean':
    case 'number':
    case 'function':
    case 'undefined':
      return '' + object;
  }

  // If we got past the above then it's an object or array or null
  
  if (object === null) return 'null';
  if (object instanceof RegExp) return object.toString();
  if (object instanceof Date) return 'new Date('+object.getTime()+')';

  if (Array.isArray(object)) return '[' + object.map(walk).join(',') + ']';

  var keys = Object.keys(object);
  if (keys.length) {
    return '{' + keys.map(function (key) {
      return '"' + key + '":' + walk(object[key]) + "\n";
    }) + '}';
  } else return '{}';
}

module.exports = walk;
