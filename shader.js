(function() {
  var canvas = document.querySelector('[data-ambient-shader]');
  if (!canvas) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    canvas.dataset.shaderState = 'static';
    canvas.style.background = [
      'radial-gradient(circle at 30% 70%, ' + canvas.dataset.tint + '55, transparent 52%)',
      'radial-gradient(circle at 72% 35%, ' + canvas.dataset.glow + '44, transparent 48%)',
      canvas.dataset.base
    ].join(', ');
    return;
  }

  var gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: false
  });
  if (!gl) return;
  canvas.dataset.shaderState = 'animated';

  var vertexSource = [
    'attribute vec2 a_position;',
    'void main() {',
    '  gl_Position = vec4(a_position, 0.0, 1.0);',
    '}'
  ].join('\n');

  var fragmentSource = [
    'precision mediump float;',
    'uniform vec2 u_resolution;',
    'uniform float u_time;',
    'uniform vec3 u_base;',
    'uniform vec3 u_tint;',
    'uniform vec3 u_glow;',
    'uniform float u_prism;',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy / u_resolution.xy;',
    '  float aspect = u_resolution.x / u_resolution.y;',
    '  vec2 point = vec2((uv.x - 0.44) * aspect, uv.y - 0.48);',
    '  float angle = -0.58;',
    '  mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));',
    '  point = rotation * point;',
    '  float radius = length(point * vec2(0.82, 1.16));',
    '  float t = u_time * 0.42;',
    '  float bend = sin(point.x * 5.0 - point.y * 2.0 + t * 0.35) * 0.13;',
    '  float ripple = sin((radius + bend) * 38.0 - t);',
    '  float innerRipple = sin((radius + bend) * 38.0 - t - 0.75);',
    '  float warmRidge = smoothstep(0.08, 0.95, ripple);',
    '  float coolRidge = smoothstep(0.22, 0.98, innerRipple);',
    '  float hardRidge = smoothstep(0.48, 0.82, ripple);',
    '  float fanAngle = atan(point.y, point.x);',
    '  float fanSlices = smoothstep(0.18, 0.82, sin(fanAngle * 17.0 + radius * 13.0 - t * 0.28));',
    '  float diagonal = fract((point.x - point.y) * 8.0 + radius * 4.0 - t * 0.08);',
    '  float silkFold = smoothstep(0.08, 0.62, diagonal) * (1.0 - smoothstep(0.62, 0.96, diagonal));',
    '  float vignette = smoothstep(0.82, 0.10, radius);',
    '  float warmShape = mix(warmRidge * 0.48, hardRidge * 0.72, u_prism);',
    '  float coolShape = mix(coolRidge * 0.34, coolRidge * 0.48, u_prism);',
    '  vec3 color = u_base;',
    '  color = mix(color, u_tint, warmShape * vignette);',
    '  color = mix(color, u_glow, coolShape * vignette);',
    '  color = mix(color, u_glow, fanSlices * vignette * u_prism * 0.20);',
    '  color = mix(color, vec3(1.0), silkFold * vignette * 0.20);',
    '  color *= 1.0 - (1.0 - silkFold) * vignette * 0.025;',
    '  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);',
    '  color += (grain - 0.5) * 0.008;',
    '  gl_FragColor = vec4(color, 1.0);',
    '}'
  ].join('\n');

  function compile(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    return shader;
  }

  var vertexShader = compile(gl.VERTEX_SHADER, vertexSource);
  var fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) return;

  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1
  ]), gl.STATIC_DRAW);

  gl.useProgram(program);
  var position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  var resolution = gl.getUniformLocation(program, 'u_resolution');
  var time = gl.getUniformLocation(program, 'u_time');

  function colorUniform(name, value) {
    var hex = value.replace('#', '');
    gl.uniform3f(
      gl.getUniformLocation(program, name),
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255
    );
  }

  colorUniform('u_base', canvas.dataset.base);
  colorUniform('u_tint', canvas.dataset.tint);
  colorUniform('u_glow', canvas.dataset.glow);
  gl.uniform1f(
    gl.getUniformLocation(program, 'u_prism'),
    canvas.dataset.prism === 'true' ? 1 : 0
  );

  function resize() {
    var ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    var width = Math.round(canvas.clientWidth * ratio);
    var height = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(resolution, width, height);
    }
  }

  var start = performance.now();
  var frame;

  function render(now) {
    resize();
    gl.uniform1f(time, (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (!document.hidden) frame = requestAnimationFrame(render);
  }

  document.addEventListener('visibilitychange', function() {
    cancelAnimationFrame(frame);
    if (!document.hidden) frame = requestAnimationFrame(render);
  });

  frame = requestAnimationFrame(render);
})();
