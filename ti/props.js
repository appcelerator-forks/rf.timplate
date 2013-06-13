(function () {

// The set of properties used to resolve media queries

var props = {
  device: Ti.Platform.osname,
  osname: Ti.Platform.osname,
  density: Ti.Platform.displayCaps.density,
  dpi: Ti.Platform.displayCaps.dpi,
  android: Ti.Platform.osname == "android"
};

if (props.android) {
  props.ios = false;
  props.iphone = false;
  props.ipad = false;
} else props.ios = true;

if (props.device == "iphone") {
  props.iphone = true;
  props.ipad = false;
  props.phone = true;
  props.formfactor = "iphone";
}

else if (props.device == "ipad") {
  props.ipad = true;
  props.iphone = false;
  props.tablet = true;
  props.formfactor = "tablet";
}

var screenInfo = function () {  
  var screenWidth = Ti.Platform.displayCaps.platformWidth;
  var screenHeight = Ti.Platform.displayCaps.platformHeight;
  var dpi = Ti.Platform.displayCaps.dpi;

  var info = {
    px: {
      x: screenWidth,
      y: screenHeight
    },
    dp: {
      x: screenWidth / (dpi / 160),
      y: screenHeight / (dpi / 160)
    },
    inches: {
      x: screenWidth / dpi,
      y: screenHeight / dpi
    },
    // calculate the diagonal
    diag: Math.sqrt(
      Math.pow((screenWidth / dpi), 2) + Math.pow((screenHeight / dpi), 2)
    ),
    dpi: dpi,
    density: Ti.Platform.displayCaps.density,

    dp2px: function (dp) { return dp * (dpi/160); },
    px2dp: function (px) { return px / (dpi/160); }
  };

  if (info.px.y == '568' && exports.os === 'iphone') info.iphone5 = true;

  return info;
};

var info = screenInfo();

if (info.diag > 6) props.formfactor = 'tablet';
else if (info.diag > 2.5) props.formfactor = 'phone';
else props.formfactor = 'tinyphone';

if (props.formfactor == 'tablet') props.tablet = true;
else props.tablet = false;

module.exports = props;

}());
