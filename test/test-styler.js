var mocha = require('mocha');

var styler;

if (process.env.TIMPLATE_COV)
  styler = require('../ti-cov/styler');
else
  styler = require('../ti/styler');

var assert = require('chai').assert;

describe('styler', function () {

  describe('buildSelectorList', function () {
    it('type, id, and class', function () {
      var list = styler.buildSelectorList("Label", {id: "foo", "class": "bar"});
      assert.equal(list[0][0], "Label");
      assert.equal(list[0][1], "#foo");
      assert.equal(list[0][2][0], ".bar");
      assert.equal(list[0][2].length, 1);

      assert.equal(list[3][0][0], ".bar");
      assert.equal(list[4][0], "#foo");
    });

    it('many classes', function () {
      var list = styler.buildSelectorList("Label", {"class": "bar baz fuz"});
      assert.equal(list[0][1][0], ".bar");
      assert.equal(list[0][1][1], ".baz");
      assert.equal(list[0][1][2], ".fuz");
      assert.equal(list[0][1].length, 3);
    });
  });

  it('defaultApply', function () {
    var dest = {foo: 1, bar: 2}, src = {bar: 3, baz: 4};
    styler.defaultApply(dest, src);

    assert.equal(dest.foo, 1);
    assert.equal(dest.bar, 2);
    assert.equal(dest.baz, 4);
  });

  it('strip', function () {
    assert.equal(styler.strip('   hi'), 'hi', 'strips left');
    assert.equal(styler.strip('hi  '), 'hi', 'strips right');
  });

  it('resolveMedia', function () {
    var node = {
      $media: [
        {query: function (props) { with (props) { return (android); }},
         styles: { color: "pink" }}
      ],
      $styles: {
        color: "blue"
      }
    };

    styler.resolveMedia(node, {android: true});

    assert.equal(node.$styles.color, "pink");
  });

  describe('resolveSubtree', function () {

    var stylesheets = {
      Label: {
        $styles: {color: "pink"},
        "#foo": { 
          $styles: {color: "blue"},
          ".bar": { $styles: { size: "big" }}
        },
        ".baz": { $styles: { left: 20 } },
        "#bus": { $styles: { top: 100 } }
      },
      ".fuz": { $styles: { top: 10 }},
      ".asdf": { $styles: { right: 15 }},
      "#primary": { $styles: { color: "purple" }}
    };

    var props = {formfactor: "tablet", android: true};

    it('handles type selector', function () {
      var styles = styler.resolve(stylesheets, props, "Label", {}); 
      assert.equal(styles.color, "pink");
    });

    it('overrides a lone class selector with a type#id sel', function () {
      var styles = styler.resolve(stylesheets, props, "Label", {
        id: "bus",
        'class': "fuz"
      }); 
      assert.equal(styles.top, 100);
    });

    it('handles type and id', function () {
      var styles = styler.resolve(stylesheets, props, "Label", {id: "foo"}); 
      assert.equal(styles.color, "blue");
    });

    it('handles type id class', function () {
      var styles = styler.resolve(stylesheets, props, "Label", {
        id: "foo",
        'class': "bar"
      });
      assert.equal(styles.color, "blue");
      assert.equal(styles.size, "big");
    });

    it('handles id alone', function () {
      var styles = styler.resolve(stylesheets, props, "Label", {id: "primary"}); 
      assert.equal(styles.color, "purple");
    });

    it('handles 2 lone classes', function () {
      var styles = styler.resolve(stylesheets, props, "Label", {
        'class': "fuz asdf"
      });
      assert.equal(styles.color, "pink");
      assert.equal(styles.top, 10);
      assert.equal(styles.right, 15);
    });

    it('handles 1 lone class', function () {
      var styles = styler.resolve(stylesheets, props, "Label", {
        'class': "fuz"
      });
      assert.equal(styles.color, "pink");
      assert.equal(styles.top, 10);
      assert.equal(styles.right, undefined);
    });

    it('handles type class and lone class', function () {
      var styles = styler.resolve(stylesheets, props, "Label", {
        'class': "baz fuz"
      });
      assert.equal(styles.left, 20);
      assert.equal(styles.top, 10);
    });

    it('preserves attributes', function () {
      var styles = styler.resolve(stylesheets, props, "Label", {
        'class': "baz fuz",
        top: 50
      });
      assert.equal(styles.top, 10);
    });

  });

});
