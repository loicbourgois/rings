import { Component } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { BrowserAnimationsModule} from '@angular/platform-browser/animations';
import { MdButtonModule, MdCheckboxModule} from '@angular/material';
import { AngularFireDatabase, FirebaseListObservable } from 'angularfire2/database';
import {MdTabsModule} from '@angular/material';
import {MdButtonToggleModule} from '@angular/material';
import {MdRadioModule} from '@angular/material';
import {Observable} from 'rxjs/Rx';
import { MidiControllerComponent } from './midi-controller/midi-controller.component';
import {MdSnackBarModule} from '@angular/material';
import {MdSnackBar} from '@angular/material';
///////////////////////////////////////////////////////////////////////////////
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  canvas1;
  canvas2;
  compositionName = "Hello World";
  codenavValue = 0;
  logsValue = 1;
  logs = "";
  time = 1.0;
  timeVar;
  globalTime = 1.0;
  globalTimeVar;
  startTime;
  lastTime = 0.0;
  canvasDimensions;
  canvasVar;
  fullscreen = false;
  fullscreenStyle = "{visibility:hidden;}";
  
  gl2;
  start = 0;
  now = 0;
  elapsed = 0;
  totalElapsed = 0;
  lastTotalElapsed = 0;
  fps = 0;
  fpsArray = Array(10).fill(0.0);
  midiCC = Array(64).fill(0.0);
  midiCCSum = Array(64).fill(0.0);
  ids = Array(16).fill(0);
  //
  vertexShaderCode = "Loading...";
  fragmentCode;
  canvas;
  vertexShader;
  fragmentShader;
  shaderProgram;

  coordinates;
  colors;
  // Vertices
  verticesBuffer;
  coordinatesVar;
  // Colors
  colorsBuffer;
  colorsVar;
  // Midi
  midiCCVar;
  midiCCSumVar;
  item;
  db;
  composition;
  
  //
  fragmentShaderCode = "Loading...";
  
  //
  fragmentShaderObservable;
  vertexShaderObservable;
  compositionObservable;
  //
  fragmentShaderSubscription;
  vertexShaderSubscription;
  loopSubscription;
  snackBar;
  //////////////////////////////////////////////////////////////////////////////
  // 
  constructor(db: AngularFireDatabase, snackBar: MdSnackBar) {
    this.db = db;
    this.loadComposition();
    this.snackBar = snackBar;
    for(let i = 1 ; i <= this.ids.length ; i++ ) {
      this.ids[i-1] = i;
    }
  }
  //////////////////////////////////////////////////////////////////////////////
  // 
  ngOnInit() {
  this.canvas1 = document.getElementById("canvas1");
	  this.canvas1.width = screen.width;
	  this.canvas1.height = screen.height;
	  this.canvas2 = document.getElementById("canvas2");
	  this.canvas2.width = screen.width;
	  this.canvas2.height = screen.height;
	  let this_ = this;
	  document.body.addEventListener('keydown', function (e) {
	    if(this_.fullscreen && e.keyCode == 27) {
	      this_.fullscreen = false;
	    }
    });​​​​​​​
	  
  }
  //////////////////////////////////////////////////////////////////////////////
  // Log
  log(message) {
    this.logs = this.logs + message + '\n';
    console.log(message);
    var textarea = document.getElementById('logs');
    if(textarea) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  }
  error(message) {
    this.logs = this.logs +"ERROR: "+ message + '\n';
    console.error(message);
    var textarea = document.getElementById('logs');
    if(textarea) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  }
  //////////////////////////////////////////////////////////////////////////////
  //
  loadComposition() {
    this.startTime = Date.now();
    this.midiCCSum = Array(64).fill(0.0);
    this.log("Loading '" + this.compositionName + "'...");
    
    let this_ = this;
    this.compositionObservable = this.db.object('/compositions/'+this.compositionName);
    this.fragmentShaderObservable = this.db.object('/compositions/'+this.compositionName+'/fragmentShader');
    this.vertexShaderObservable = this.db.object('/compositions/'+this.compositionName+'/vertexShader');
    
    
    if(this.fragmentShaderSubscription) {
      this.fragmentShaderSubscription.unsubscribe();
    }
    this.fragmentShaderSubscription = this.fragmentShaderObservable.subscribe(fragmentShader => {
      this_.fragmentShaderCode = fragmentShader.$value;
      this_.rebuildShadersAndLoop();
    });
    if(this.vertexShaderSubscription) {
      this.vertexShaderSubscription.unsubscribe();
    }
    this.vertexShaderSubscription = this.vertexShaderObservable.subscribe(vertexShader => {
      this_.vertexShaderCode = vertexShader.$value;
      this_.rebuildShadersAndLoop();
    });
  }
  //////////////////////////////////////////////////////////////////////////////
  //
  rebuildShadersAndLoop() {
    let this_ = this;
    this.log("Rebuilding...");
    if(this.fragmentShaderCode == null) {
      let sub = this.db.object('/compositions/Default/fragmentShader').subscribe(fragmentShader=> {
        this_.fragmentShaderObservable.set(fragmentShader.$value);
        this_.fragmentShaderCode = fragmentShader.$value;
        sub.unsubscribe();
      });
    }
    if(this.vertexShaderCode == null) {
      let sub = this.db.object('/compositions/Default/vertexShader').subscribe(vertexShader=> {
        this_.vertexShaderObservable.set(vertexShader.$value);
        this_.vertexShaderCode = vertexShader.$value;
        sub.unsubscribe();
      });
    }
    if(this.fragmentShaderCode == "Loading..."
        || this.vertexShaderCode == "Loading...") {
      return;
    } 
    //
    try {
      this.rebuild();
    } catch (e) {
      this.error("Error while rebuilding");
      return;
    }
    this.log("Rebuild ok.");
    this.log("Looping :)");
    if(this.loopSubscription) {
      this.loopSubscription.unsubscribe();
    }
    this.loopSubscription = Observable.interval(1000/100).subscribe((x) => {
      this_.loop();
    });
  } 
  //////////////////////////////////////////////////////////////////////////////
  //
  rebuild() {
    
    //this.canvas2.width = document.getElementById("outerCanvas2").offsetWidth;
    //console.log(this.canvas2.width);
    //this.canvas2.height = document.getElementById("outerCanvas2").offsetHeight;
  
  
    try {
	    this.gl2 = this.canvas2.getContext('experimental-webgl');
    } catch (e) {
	    throw new Error('no WebGL found');
    }
    this.coordinates = [1.0,1.0,-1.0,1.0,1.0,-1.0,-1.0, -1.0];
	  this.colors = [1.0, 0.5, 0.5, 1.0,0.5, 1.0, 0.5, 1.0,0.5, 0.5, 1.0, 1.0,1.0, 1.0, 0.5, 1.0];
    this.verticesBuffer = this.gl2.createBuffer();
    this.gl2.bindBuffer(this.gl2.ARRAY_BUFFER, this.verticesBuffer);
    this.gl2.bufferData(this.gl2.ARRAY_BUFFER, new Float32Array(this.coordinates), this.gl2.STATIC_DRAW);
    this.colorsBuffer = this.gl2.createBuffer();
    this.gl2.bindBuffer(this.gl2.ARRAY_BUFFER, this.colorsBuffer);
    this.gl2.bufferData(this.gl2.ARRAY_BUFFER, new Float32Array(this.colors), this.gl2.STATIC_DRAW);
    this.vertexShader = this.gl2.createShader(this.gl2.VERTEX_SHADER);
    this.gl2.shaderSource(this.vertexShader, this.vertexShaderCode);
    this.gl2.compileShader(this.vertexShader);
    if (!this.gl2.getShaderParameter(this.vertexShader, this.gl2.COMPILE_STATUS)) {
	    let error = ("Invalid Vertex Shader: " + this.gl2.getShaderInfoLog(this.vertexShader));
	    this.error(error);
	    throw new Error(error);
    }
    this.fragmentShader = this.gl2.createShader(this.gl2.FRAGMENT_SHADER);
    this.gl2.shaderSource(this.fragmentShader, this.fragmentShaderCode);
    this.gl2.compileShader(this.fragmentShader);
    if (!this.gl2.getShaderParameter(this.fragmentShader, this.gl2.COMPILE_STATUS)) {
	    let error = ("Invalid Fragment Shader: " + this.gl2.getShaderInfoLog(this.fragmentShader));
	    this.error(error);
	    throw new Error(error);
    }
    this.shaderProgram = this.gl2.createProgram();
	  this.gl2.attachShader(this.shaderProgram, this.vertexShader);
	  this.gl2.attachShader(this.shaderProgram, this.fragmentShader);
  }
  //////////////////////////////////////////////////////////////////////////////
  //
  loop() {
	  this.gl2.linkProgram(this.shaderProgram);
	  this.gl2.useProgram(this.shaderProgram);
	  if (!this.gl2.getProgramParameter(this.shaderProgram, this.gl2.LINK_STATUS)) {
		  throw new Error(this.gl2.getProgramInfoLog(this.shaderProgram));
	  }
	  //
	  this.colorsVar = this.gl2.getAttribLocation(this.shaderProgram, "colors");
	  this.gl2.enableVertexAttribArray(this.colorsVar);
	  this.gl2.bindBuffer(this.gl2.ARRAY_BUFFER, this.colorsBuffer);
	  this.gl2.vertexAttribPointer(this.colorsVar, 4, this.gl2.FLOAT, false, 0, 0);
	  this.coordinatesVar = this.gl2.getAttribLocation(this.shaderProgram, "coordinates");
	  this.gl2.enableVertexAttribArray(this.coordinatesVar);
	  this.gl2.bindBuffer(this.gl2.ARRAY_BUFFER, this.verticesBuffer);
	  this.gl2.vertexAttribPointer(this.coordinatesVar, 2, this.gl2.FLOAT, false, 0, 0);
	  //
	  this.midiCCVar = this.gl2.getUniformLocation(this.shaderProgram, "midiCC");
	  this.gl2.uniform1fv(this.midiCCVar, this.midiCC);
	  //
	  this.midiCCSumVar = this.gl2.getUniformLocation(this.shaderProgram, "midiCCSum");
	  this.gl2.uniform1fv(this.midiCCSumVar, this.midiCCSum);
	  //
	  this.lastTime = this.time;
	  this.time = (Date.now()-this.startTime);
	  this.elapsed = this.time-this.lastTime;
	  this.fpsArray.shift();
	  this.fpsArray.push(1000.0/this.elapsed);
	  this.fps = this.fpsArray.reduce(function(a, b) { return a + b; });
    this.fps /= this.fpsArray.length;
	  this.timeVar = this.gl2.getUniformLocation(this.shaderProgram, "time");
	  this.gl2.uniform1f(this.timeVar, this.time);
	  //
	  this.globalTime = Date.now();
	  this.globalTimeVar = this.gl2.getUniformLocation(this.shaderProgram, "globalTime");
	  this.gl2.uniform1f(this.globalTimeVar, this.globalTime);
	  //
	  this.canvasDimensions = [(document.getElementById("outerCanvas2").offsetWidth), 
	    (document.getElementById("outerCanvas2").offsetHeight)];
	  this.canvasVar = this.gl2.getUniformLocation(this.shaderProgram, "canvas");
	  //console.log(this.canvasDimensions);
	  this.gl2.uniform1fv(this.canvasVar, this.canvasDimensions);
	  //
	  this.gl2.clearColor(0.0, 0.0, 0.0, 1.0);
	  this.gl2.clear(this.gl2.COLOR_BUFFER_BIT);
	  this.gl2.drawArrays(this.gl2.TRIANGLE_STRIP, 0, 4);/**/
  }
  //////////////////////////////////////////////////////////////////////////////
  //
  //////////////////////////////////////////////////////////////////////////////
  fragmentShaderCodeChanged(value) {
    this.fragmentShaderObservable.set(value);
    this.rebuildShadersAndLoop();
  }
  
  vertexShaderCodeChanged(value) {
    this.vertexShaderObservable.set(value);
    this.rebuildShadersAndLoop();
  }
  
  compositionNameChanged(value) {
    //this.log(value);
  }
  
  go() {
    //this.log(this.compositionName);
  }
  
  controllerChanged(value) {
    //console.log("v " + value.id);
    this.midiCC[value.id] = value.out;
    this.midiCCSum[value.id] += value.out;
  }
  
  
  
  codenavChanged(value) {
    switch(value) {
      case 0 : {
        break;
      }
      case 1 : {
        break;
      }
      case 2 : {
        break;
      }
      default : {
        break;
      }
    }
  }
  goFullscreen() {
    this.fullscreen = true;
    
    let canvas = document.getElementById("canvas2");
    canvas.style.width = String(document.body.clientWidth); //document.width is obsolete
    canvas.style.height = String(document.body.clientHeight); //document.height is obsolete
    
    this.snackBar.open('You\'re now in fullscreen. Press Escape to leave.', 'OK', {
      duration: 3000
    });
    
    /*canvasW = canvas.width;
    canvasH = canvas.height;*/
    
  }
  test() {
    console.log("iiu");
  }
  
}