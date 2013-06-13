var compiler = require('../css');
var YAML = require('libyaml');
var assert = require('assert');
var util = require('util');

function p (asdf) { console.log("\n" + util.inspect(asdf, true, 10, true)); }

describe('compiler', function () {

  describe('processSelector', function () {
    it('is exported', function () { 
      assert(typeof compiler.processSelector == "function");
    });

    function testSel (name, selector, expect) {
      it(name, function () {
        var ret = compiler.processSelector(selector);
        assert.deepEqual(ret, expect);
      });
    }

    testSel('handles type alone', 'Label', [{type: "Label"}]);
    testSel('handles type and id', 'Label#foo', [{type: "Label", id: "foo"}]);
    testSel('handles type, id, class', 'Label#foo.bar', [{
      type: "Label",
      id: "foo",
      classes: ["bar"]
    }]);

    testSel('handles type, id, classes', 'Label#foo.bar.baz', [{
      type: "Label",
      id: "foo",
      classes: ["bar", "baz"]
    }]);

    testSel('handles id, class', '#foo.baz', [{
      id: "foo",
      classes: ["baz"]
    }]);

    testSel('handles id, classes', '#foo.baz.bar', [{
      id: "foo",
      classes: ["baz", "bar"]
    }]);

    testSel('handles classes', '.baz.bar', [{classes: ["baz", "bar"]}]);

    it('throws on descendency', function () {
      try {
        compiler.processSelector('foo bar');
        assert(false);
      } catch (e) {
        assert(e.message == "Combinators not supported");
      }
    });

    testSel('handles multiple', 'Label#foo, Window.bar.baz, #primary.blue', [
      {type: "Label", id: "foo"},
      {type: "Window", classes: ["bar", "baz"]},
      {id: "primary", classes: ["blue"]}
    ]);

  });
/*
  describe('compileQuery', function () {
    
    it('is exported', function () { 
      assert(typeof compiler.compileQuery == "function");
    });

    function testQuery (name, query, locals, expect) {
      it(name, function () {
        var compiled = compiler.processMedia(query);
        var ret = compiled(locals);
        assert(ret === expect);
      });
    }

    testQuery('single var', '$android', {android: true}, true);
    testQuery('single var false', '$android', {android: false}, false);

    testQuery('and', '$android and tablet', {
      android: true,
      tablet: false
    }, false);

    testQuery('and', '$android and tablet', {
      android: true,
      tablet: true
    }, true);

    testQuery('or', '$android or tablet', {
      android: true,
      tablet: false
    }, true);

    testQuery('complex', '$(android or tablet) and (iphone or ipad)', {
      android: false,
      tablet: true,
      iphone: false,
      ipad: true
    }, true);

  });
  */
});

describe('tokenizer', function () {
  it('works', function () {
    var tokenizer = require('../tokenizer');

    var terminals = {
      ident: "^([a-zA-Z/g-]+)",
      id: "^/g#",
      'class': "^/g.",
      space: "^ ",
      or: "^, "
    };

    var t = tokenizer(terminals);

    var str = "type#id.class";

    assert.deepEqual(t(str), {type: "ident", str: "type"});
  });
});

