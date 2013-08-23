# timplate

Stylesheet & template engine for Titanium. Deprecates 
[tylus](http://github.com/russfrank/tylus). Still very much an alpha level
project, but it does work and is currently used in the beta version of the
RU Mobile app.

## Usage

First, you'll need to install `net.iamyellow.tiws`, a websocket implementation
in a Titanium module. It's in the deps/ directory. Then you'll need to copy
the files in ti/ into your Resources/timplate/ folder. Eventually I'll have
an installer that makes this easy, but the project is still young.

Then, after installing timplate with the -g flag, you run `timplate -w` in the
root directory of your project. Stylesheets go in a stylesheets folder and
templates in a templates folder. Currently, it supports:

* jade
* ejs
* handlebars
* eco
* stylus
* raw css

So, you can put down a `templates/index.jade` file that looks like this

```jade
Window#win
  Button#foo(onClick="foo")= variable
  Button#bar(onClick="bar") test 2
```

and a `stylesheets/index.styl` that looks like this

```stylus
Window#win
  layout vertical

  @device iphone
    backgroundColor blue

  @device android
    backgroundColor red

Button#foo
  borderColor pink
  borderRadius 2

Button#bar
  backgroundColor orange
```

Then, in your Resources/app.js, you'd do this:

```javascript
var T = require('timplate/timplate');
var indexTemplate = T('index');

var index = indexTemplate({variable: 'foo button'});
index.win.open();

index.on('foo', function () {
  alert('foo clicked');
});

index.on('bar', function () {
  alert('bar clicked');
});
```

So there's a lot going on. But basically, you can make templates and stylesheets
and use them in your app; events get fired on the template object that's
returned. Items with IDs get dropped onto this object as well (hence the
`index.win`). This is deserving of much more documentation of course.

