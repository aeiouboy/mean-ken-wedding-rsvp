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
    'float bloom(vec2 uv, vec2 center, float radius) {',
    '  float distanceFromCenter = length(uv - center);',
    '  return smoothstep(radius, 0.0, distanceFromCenter);',
    '}',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy / u_resolution.xy;',
    '  uv.x *= u_resolution.x / u_resolution.y;',
    '  float aspect = u_resolution.x / u_resolution.y;',
    '  float t = u_time * 0.11;',
    '  vec2 first = vec2(aspect * (0.30 + 0.06 * sin(t)), 0.72 + 0.04 * cos(t * 0.8));',
    '  vec2 second = vec2(aspect * (0.72 + 0.05 * cos(t * 0.7)), 0.35 + 0.05 * sin(t * 0.9));',
    '  vec2 third = vec2(aspect * 0.50, 0.52 + 0.04 * sin(t * 0.55));',
    '  float firstBloom = bloom(uv, first, 0.62);',
    '  float secondBloom = bloom(uv, second, 0.58);',
    '  float centerGlow = bloom(uv, third, 0.48);',
    '  vec3 color = u_base;',
    '  color = mix(color, u_tint, firstBloom * 0.34);',
    '  color = mix(color, u_glow, secondBloom * 0.26);',
    '  color = mix(color, vec3(1.0), centerGlow * 0.16);',
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
