import $ from 'jquery'
var gl;
var $window = $(window); // There is only one window, so why not cache the jQuery-wrapped window?

const loadConfig = (a, b) => {
  var canvas = document.createElement('canvas');
  gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    // Browser does not support WebGL.
    return null;
  }

  // Load extensions
  var extensions = {};

  [
    'OES_texture_float',
    'OES_texture_half_float',
    'OES_texture_float_linear',
    'OES_texture_half_float_linear'
  ].forEach(function (name) {
    var extension = gl.getExtension(name);
    if (extension) {
      extensions[name] = extension;
    }
    // If no floating point extensions are supported we can bail out early.
    if (!extensions.OES_texture_float) {
      return null;
    }
  });

  var configs = [];
  const createConfig = (type, glType, arrayType) => {
    var name = 'OES_texture_' + type,
      nameLinear = name + '_linear',
      linearSupport = nameLinear in extensions,
      configExtensions = [name];

    if (linearSupport) {
      configExtensions.push(nameLinear);
    }

    let returnObj = {
      type: glType,
      arrayType: arrayType,
      linearSupport: linearSupport,
      extensions: configExtensions
    };


    return returnObj;
  }

  configs.push(
    createConfig('float', gl.FLOAT, Float32Array)
  );

  if (extensions.OES_texture_half_float) {
    configs.push(
      // Array type should be Uint16Array, but at least on iOS that breaks. In that case we
      // just initialize the textures with data=null, instead of data=new Uint16Array(...).
      // This makes initialization a tad slower, but it's still negligible.
      createConfig('half_float', extensions.OES_texture_half_float.HALF_FLOAT_OES, null)
    );
  }

  // Setup the texture and framebuffer
  var texture = gl.createTexture();
  var framebuffer = gl.createFramebuffer();

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Check for each supported texture type if rendering to it is supported
  var config = null;

  for (var i = 0; i < configs.length; i++) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 32, 32, 0, gl.RGBA, configs[i].type, null);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
      config = configs[i];
      break;
    }
  }

  return config;
};

const createImageData = (width, height) => {
  try {
    return new ImageData(width, height);
  }
  catch (e) {
    // Fallback for IE
    var canvas = document.createElement('canvas');
    return canvas.getContext('2d').createImageData(width, height);
  }
}

const translateBackgroundPosition = value => {
  var parts = value.split(' ');

  if (parts.length === 1) {
    switch (value) {
      case 'center':
        return ['50%', '50%'];
      case 'top':
        return ['50%', '0'];
      case 'bottom':
        return ['50%', '100%'];
      case 'left':
        return ['0', '50%'];
      case 'right':
        return ['100%', '50%'];
      default:
        return [value, '50%'];
    }
  }
  else {
    return parts.map(function (part) {
      switch (value) {
        case 'center':
          return '50%';
        case 'top':
        case 'left':
          return '0';
        case 'right':
        case 'bottom':
          return '100%';
        default:
          return part;
      }
    });
  }
}

const createProgram = (vertexSource, fragmentSource, uniformValues) => {
  const compileSource = (type, source) => {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error('compile error: ' + gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  var program = {};
  program.id = gl.createProgram();
  gl.attachShader(program.id, compileSource(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program.id, compileSource(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program.id);
  if (!gl.getProgramParameter(program.id, gl.LINK_STATUS)) {
    throw new Error('link error: ' + gl.getProgramInfoLog(program.id));
  }

  // Fetch the uniform and attribute locations
  program.uniforms = {};
  program.locations = {};
  gl.useProgram(program.id);
  gl.enableVertexAttribArray(0);
  var match, name, regex = /uniform (\w+) (\w+)/g, shaderCode = vertexSource + fragmentSource;
  while ((match = regex.exec(shaderCode)) != null) {
    name = match[2];
    program.locations[name] = gl.getUniformLocation(program.id, name);
  }

  return program;
}

const bindTexture = (texture, unit) => {
  gl.activeTexture(gl.TEXTURE0 + (unit || 0));
  gl.bindTexture(gl.TEXTURE_2D, texture);
}

const extractUrl = value => {
  var urlMatch = /url\(["']?([^"']*)["']?\)/.exec(value);
	if (urlMatch == null) {
		return null;
	}
	return urlMatch[1];
}

const isDataUri = url => url.match(/^data:/);

var config = loadConfig();
var transparentPixels = createImageData(32, 32);

// Extend the css
$('head').prepend('<style>.jquery-ripples { position: relative; z-index: 0; }</style>');
