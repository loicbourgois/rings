const BUFFER_LENGTH = 2;

let codenavValue = 0;
let logsValue = 1;
let logs = "";
let time = 1.0;
let timeVar;
let globalTime = 1.0;
let globalTimeVar;
let startTime;
let lastTime = 0.0;
let canvasDimensions;
let canvasVar;
let fullscreen = false;
let fullscreenStyle = "{visibility:hidden;}";

let gl2;
let start = 0;
let now = 0;
let elapsed = 0;
let totalElapsed = 0;
let lastTotalElapsed = 0;
let fps = 0;
let fpsArray = Array(10).fill(0.0);
let midiCC = Array(64).fill(0.0);
let midiCCSum = Array(64).fill(0.0);
let ids = Array(16).fill(0);
//
let vertexShaderCode = "Loading...";
let fragmentCode;
let canvas;
let vertexShader;
let fragmentShader;
let shaderProgram;

let coordinates;
let colors;
// Vertices
let verticesBuffer;
let coordinatesVar;
// Colors
let colorsBuffer;
let colorsVar;
// Midi
let midiCCVar;
let midiCCSumVar;

//
let fragmentShaderCode = "Loading...";

//
let fragmentShaderObservable;
let vertexShaderObservable;
let compositionObservable;
//
let fragmentShaderSubscription;
let vertexShaderSubscription;

let midiCCHistory = Array(64).fill(0.0);
let midiCCInstant = Array(64).fill(0.0);

function main() {
	startTime = Date.now();
    midiCCSum = Array(64).fill(0.0);
	canvas = document.getElementById("canvas");
	canvas.width = screen.width;
	canvas.height = screen.height;
	initMidi();
	initShaders();
	rebuild();
	setInterval(loop, 10);
	setInterval(updateMidi, 10);
	setInterval(function() {
		console.log(fps)
	}, 1000);
}

function initMidi() {
	for(let i = 0 ; i < 64 ; i++) {
		midiCCHistory[i] = Array(64).fill(0.0);
	}
	if (navigator["requestMIDIAccess"]) {
		navigator["requestMIDIAccess"]({
			sysex: false 
		}).then(this.onMIDISuccess.bind(this), this.onMIDIFailure.bind(this));
	} else {
		console.error("No MIDI support in your browser.");
	}
}

function onMIDIFailure(e) {
    console.error("No access to MIDI devices or your browser doesn't support WebMIDI API. Please use WebMIDIAPIShim " + e);
  }
  
function onMIDISuccess(midi) {
    let inputs = midi.inputs.values();
    for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
      input.value.onmidimessage = onMIDIMessage.bind(this);
    }
}

function onMIDIMessage(message) {
	let data = message.data;
	if(0 < data[1] && data[1] < 64) {
		midiCCInstant[data[1]] = data[2];
	}
}

function updateMidi() {
	let out = 0;
	for(let i = 0 ; i < 64 ; i++ ) {
		midiCCHistory[i].unshift(midiCCInstant[i]);
		out = 0;
		for(let j = 0 ; j < BUFFER_LENGTH ; j++) {
			out += midiCCHistory[i][j];
		}
		midiCC[i] = out / BUFFER_LENGTH / 127.0 ;
		out = 0;
	}
}


function initShaders() {
	vertexShaderCode = `
		////////////////////////////////////////////////////////////////
// Vertex Shader for the Default composition

////////////////////////////////////////////////////////////////
// Inits
precision mediump float;
attribute vec2 coordinates;
attribute vec4 colors;
uniform float midiCC[32];
uniform float canvas[2];
varying vec4 vcolor;
varying vec2 vpos;

////////////////////////////////////////////////////////////////
// Random
float random(vec4 v4) {
  return fract(sin(dot(
    10.0*v4.xy,
    vec2(12.9898,78.233)))*43758.5453);
}
vec3 random3(vec4 v4) {
  return vec3(random(v4), random(v4*2.0), random(v4*3.0));
}

////////////////////////////////////////////////////////////////
// Main
void main(void) {
  gl_Position = vec4(coordinates*vec2(1,1), 0.0, 1.0);
  vpos = coordinates*vec2(1,1)*vec2(canvas[0]/canvas[1]*1.0,1.0)*1.50;
  vcolor = colors;
}

	`;
	fragmentShaderCode = `
		////////////////////////////////////////////////////////////////
// Fragment Shader for the Default composition

////////////////////////////////////////////////////////////////
// Inits
precision mediump float;
varying vec4 vcolor;
varying vec2 vpos;
uniform float midiCC[32];
uniform float time;

////////////////////////////////////////////////////////////////
// Random
float random(vec4 v4) {
  return fract(sin(dot(
    10.0*v4.xy,
    vec2(12.9898,78.233)))*43758.5453);
}
vec3 random3(vec4 v4) {
  return vec3(random(v4), random(v4*2.0), random(v4*3.0));
}
#define count 21

////////////////////////////////////////////////////////////////
// Main 
void main(void) {
  vec2 p = vpos;
  vec3 c = vec3(vcolor);
  c = vec3(1, 1, 1);
  
  c *= 1.0;
  float a = p.x*p.x + p.y*p.y;
  float l = 1.5 / float(count);
  float d;
  for(int i= 1 ; i < count ; i += 1) {
    float b = l * float(i-1);
    d = b+l;
    b *= b;
    d *= d;
    if(b <  a && a < d ) {
      c *= midiCC[i];
    }
  }

  if(a >= d ) {
    c *= 0.0;
  }
  c = sqrt(c);
  
  gl_FragColor = vec4(c, 1.0);
}

	`;
}

function rebuild() {
    try {
	    gl2 = canvas.getContext('experimental-webgl');
    } catch (e) {
	    throw new Error('no WebGL found');
    }
	coordinates = [1.0,1.0,-1.0,1.0,1.0,-1.0,-1.0, -1.0];
	colors = [1.0, 0.5, 0.5, 1.0,0.5, 1.0, 0.5, 1.0,0.5, 0.5, 1.0, 1.0, 1.0, 1.0, 0.5, 1.0];
    verticesBuffer = gl2.createBuffer();
    gl2.bindBuffer(gl2.ARRAY_BUFFER, verticesBuffer);
    gl2.bufferData(gl2.ARRAY_BUFFER, new Float32Array(coordinates), gl2.STATIC_DRAW);
    colorsBuffer = gl2.createBuffer();
    gl2.bindBuffer(gl2.ARRAY_BUFFER, colorsBuffer);
    gl2.bufferData(gl2.ARRAY_BUFFER, new Float32Array(colors), gl2.STATIC_DRAW);
    vertexShader = gl2.createShader(gl2.VERTEX_SHADER);
    gl2.shaderSource(vertexShader, vertexShaderCode);
    gl2.compileShader(vertexShader);
    if (!gl2.getShaderParameter(vertexShader, gl2.COMPILE_STATUS)) {
	    let error = ("Invalid Vertex Shader: " + gl2.getShaderInfoLog(vertexShader));
	    error(error);
	    throw new Error(error);
    }
    fragmentShader = gl2.createShader(gl2.FRAGMENT_SHADER);
    gl2.shaderSource(fragmentShader, fragmentShaderCode);
    gl2.compileShader(fragmentShader);
    if (!gl2.getShaderParameter(fragmentShader, gl2.COMPILE_STATUS)) {
	    let error = ("Invalid Fragment Shader: " + gl2.getShaderInfoLog(fragmentShader));
	    error(error);
	    throw new Error(error);
    }
    shaderProgram = gl2.createProgram();
	gl2.attachShader(shaderProgram, vertexShader);
	gl2.attachShader(shaderProgram, fragmentShader);
}

function loop() {
	gl2.linkProgram(shaderProgram);
	gl2.useProgram(shaderProgram);
	if (!gl2.getProgramParameter(shaderProgram, gl2.LINK_STATUS)) {
	  throw new Error(gl2.getProgramInfoLog(shaderProgram));
	}
	//
	colorsVar = gl2.getAttribLocation(shaderProgram, "colors");
	gl2.enableVertexAttribArray(colorsVar);
	gl2.bindBuffer(gl2.ARRAY_BUFFER, colorsBuffer);
	gl2.vertexAttribPointer(colorsVar, 4, gl2.FLOAT, false, 0, 0);
	coordinatesVar = gl2.getAttribLocation(shaderProgram, "coordinates");
	gl2.enableVertexAttribArray(coordinatesVar);
	gl2.bindBuffer(gl2.ARRAY_BUFFER, verticesBuffer);
	gl2.vertexAttribPointer(coordinatesVar, 2, gl2.FLOAT, false, 0, 0);
	//
	midiCCVar = gl2.getUniformLocation(shaderProgram, "midiCC");
	gl2.uniform1fv(midiCCVar, midiCC);
	//
	midiCCSumVar = gl2.getUniformLocation(shaderProgram, "midiCCSum");
	gl2.uniform1fv(midiCCSumVar, midiCCSum);
	//
	lastTime = time;
	time = (Date.now()-startTime);
	elapsed = time-lastTime;
	fpsArray.shift();
	fpsArray.push(1000.0/elapsed);
	fps = fpsArray.reduce(function(a, b) { return a + b; });
	fps /= fpsArray.length;
	timeVar = gl2.getUniformLocation(shaderProgram, "time");
	gl2.uniform1f(timeVar, time);
	//
	globalTime = Date.now();
	globalTimeVar = gl2.getUniformLocation(shaderProgram, "globalTime");
	gl2.uniform1f(globalTimeVar, globalTime);
	//
	canvasDimensions = [(document.getElementById("canvas").offsetWidth), 
	(document.getElementById("canvas").offsetHeight)];
	canvasVar = gl2.getUniformLocation(shaderProgram, "canvas");
	//console.log(canvasDimensions);
	gl2.uniform1fv(canvasVar, canvasDimensions);
	//
	gl2.clearColor(0.0, 0.0, 0.0, 1.0);
	gl2.clear(gl2.COLOR_BUFFER_BIT);
	gl2.drawArrays(gl2.TRIANGLE_STRIP, 0, 4);/**/
}

function autorun() {
	main();
}
if (document.addEventListener) document.addEventListener('DOMContentLoaded', autorun, false);
else if (document.attachEvent) document.attachEvent('onreadystatechange', autorun);
else window.onload = autorun;