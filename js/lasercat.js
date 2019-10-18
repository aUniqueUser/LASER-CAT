var LaserCat = function() {

  this.sounds = (function() {

    var audioContext;
    var pendingFiles = 0;

    var sounds = {
      "meow" : {
        "path" : "sounds/meow.mp3",
        "loop" : false,
        "loopTime" : [0.1, 1.1],
        "pitchSpread" : [0.85, 1.1],
        "loaded" : false
      },
      "laserHit" : {
        "path" : "sounds/laser-start.mp3",
        "loop" : false,
        "pitchSpread" : [0.85, 1.1],
        "loaded" : false
      },
      "laserBeam" : {
        "path" : "sounds/laser-loop.mp3",
        "loop" : true,
        "loopTime" : [0.2, 1.6],
        "loaded" : false
      }
    };

    var globalGain;
    var loaded = false;
    var enabled = true;

    function playSound(buffer, gain) {
     if(!loaded || !enabled){
       return;
      }

      var source = audioContext.createBufferSource();
      source.buffer = buffer;
      
      var soundGain = audioContext.createGain();
      soundGain.gain.value = gain || 1;
      
      source.connect(soundGain);
      soundGain.connect(globalGain);
      source.noteOn(0);
    }

    function loadBuffer(url, name, callback){
      var request = new XMLHttpRequest();

      request.open('GET', chrome.extension.getURL(url), true);
      request.responseType = 'arraybuffer';

      request.onload = function() {
        audioContext.decodeAudioData(request.response, function(buffer){
          callback(buffer, name);
        });
      };

      request.send();
    }

    function init(onReady) {
      if ('undefined' === typeof window.AudioContext) {
        enabled = false;
        return;
      }

      // get the audio context
      audioContext = new AudioContext();
      
      globalGain = audioContext.createGain();
      globalGain.connect(audioContext.destination);

      for(var itm in sounds){
        if(sounds.hasOwnProperty(itm) && !sounds[itm].loaded){
          
          pendingFiles++;

          loadBuffer(sounds[itm].path, itm, function(buff, name) {
            sounds[name].buffer = buff;
            sounds[name].loaded = true;
            pendingFiles--;
            if(pendingFiles <= 0){
              onReady();
            }
          });
        }
      }

      if(pendingFiles <= 0) {
        // nothing to load, fire the ready callback immediately.
        onReady();
      }
    }

    function shutdown() {
      
      globalGain.disconnect();
      audioContext.close();
    }

    return {

      isLoaded : function() {
        return loaded;
      },

      initialize : function(onReady) {
        init(onReady);
        loaded = true;
      },

      shutdown : function() {
        shutdown();
      },

      getSound : function(sound) {
        if(sounds[sound]){
          var source = audioContext.createBufferSource();
          
          source.buffer = sounds[sound].buffer;
          source.loop = sounds[sound].loop;

         if(sounds[sound].loopTime) {
            source.loopStart = sounds[sound].loopTime[0];
            source.loopEnd = sounds[sound].loopTime[1];
          }

          source.gain = audioContext.createGain();
          source.connect(source.gain);
          source.gain.connect(globalGain);

          return {
            "setGain" : function(value){
              source.gain.gain.value = value;
            },
            "stop" : function(){
              source.stop();
            },
            "start" : function(){
              source.start(0);
            }
          }
        }
      },

      playSound : function(sound) {
        if(sounds[sound]) {
          var source = audioContext.createBufferSource();

          source.buffer = sounds[sound].buffer;
          source.gain = audioContext.createGain();
          source.connect(source.gain);

          if(sounds[sound].pitchSpread){
            source.playbackRate.value = Math.random() * (sounds[sound].pitchSpread[1] - sounds[sound].pitchSpread[0]) + sounds[sound].pitchSpread[0];
          }
          
          source.gain.connect(globalGain);

          source.start(0);

          return source;
        }
      }
    }
  })();


  this.laserLoop = null;

	this.active = false;
	this.canvas = null;
	this.context = null;
	this.catImage = null;
	this.shoot = false;
	this.alpha = 0;

  this.laserGain = 0;

	this.catReveal = 0;
	this.transition = false;

  this.now = 0;

	this.target = {
		x:0,
		y:0
	};

  this.catPos = {
    x:0,
    y:0,
    angle: 0
  };

  this.catHeadPos = {
    x:230,
    y:135,
    angle: 0,
    parent: this.catPos
  };

  this.leftEye = {
    "x" : -8,
    "y" : -52,
    parent: this.catHeadPos
  };

  this.rightEye = {
    "x" : 52,
    "y" : -52,
    parent: this.catHeadPos
  };

	var self = this;

	window.addEventListener("resize", function() {
		self.resize();
	});
};

LaserCat.prototype.makeStuff = function() {
	
  this.canvas = document.createElement("canvas");

  this.canvas.width = window.innerWidth;
  this.canvas.height = window.innerHeight;

  this.context = this.canvas.getContext("2d");

  document.body.appendChild(this.canvas);

  this.canvas.style.position        = "fixed";
  this.canvas.style.top             = "0px";
  this.canvas.style.left            = "0px";
  this.canvas.style.width           = window.innerWidth + "px";
  this.canvas.style.height          = window.innerHeight + "px";
  this.canvas.style.zIndex          = "25000";
  this.canvas.style.backgroundColor = "transparent";

  var self = this;
  this.canvas.addEventListener("mousemove", function(e){
   // if(self.shoot && !self.transition){
      self.target.x = e.clientX;
      self.target.y = e.clientY;
    //}
  });

  this.canvas.addEventListener("mouseout", function(e){
    self.shoot = false;
    self.laserLoop.setGain(0);
  });

  this.canvas.addEventListener("mousedown", function(e){
    self.target.x = e.clientX;
    self.target.y = e.clientY;
    if(!self.transition) {
    	
      if(!self.shoot) {
        self.sounds.playSound("laserHit");
        self.laserLoop.setGain(1);
      }
      self.shoot = true;

  	}
    e.preventDefault();
  });

  this.canvas.addEventListener("mouseup", function(e){
    self.shoot = false;
    self.laserLoop.setGain(0);
  });

  this.cat = document.createElement("img");
  this.cat.src = chrome.extension.getURL("images/cat-body.png");

  this.catHead = document.createElement("img");
  this.catHead.src = chrome.extension.getURL("images/cat-head.png");


 	this.active = true;


 	requestAnimationFrame(function() {
 		self.animate()
 	});
}

LaserCat.prototype.resize = function() {
	if(this.active) {
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
		
    this.canvas.style.width = window.innerWidth + "px";
    this.canvas.style.height = window.innerHeight + "px";
	}
}

LaserCat.prototype.getWorldCoords = function(coords) {

  var node = coords;
  
  var output = {
    "x" : 0,
    "y" : 0
  };

  do {

    var parentAngle = (node.parent != null) ? node.parent.angle : 0;
    
    var rotatedX = Math.cos(parentAngle) * node.x - Math.sin(parentAngle) * node.y;
    var rotatedY = Math.sin(parentAngle) * node.x + Math.cos(parentAngle) * node.y;
    
    output.x += rotatedX;
    output.y += rotatedY;

    node = node.parent;

  } while(node != null);

  output.y += window.innerHeight - this.catReveal;

  return output;
}

LaserCat.prototype.animate = function() {

    var translatedHead = this.getWorldCoords(this.catHeadPos);

    this.catHeadPos.angle = Math.atan2(this.target.y - translatedHead.y, this.target.x - translatedHead.x);
    this.catHeadPos.angle *= 0.1;
    this.catHeadPos.angle = Math.max(-0.48, this.catHeadPos.angle);
    this.catHeadPos.angle = Math.min(0.03, this.catHeadPos.angle);

    var leftEye = this.getWorldCoords(this.leftEye);
    var rightEye = this.getWorldCoords(this.rightEye);


    var ctx = this.context;
    ctx.clearRect(0,0, this.canvas.width, this.canvas.height);
    ctx.save();    

    ctx.translate(0, window.innerHeight - this.catReveal);


    ctx.drawImage(this.cat, this.catPos.x, this.catPos.y, 400, 312);
    

    ctx.save();
    ctx.translate(this.catHeadPos.x, Math.floor(this.catHeadPos.y))
    ctx.rotate( this.catHeadPos.angle );
    ctx.drawImage(this.catHead, -120, -120, 240, 240);
    ctx.restore();
    
    ctx.restore();

    /*
    ctx.fillStyle = "green";
    ctx.fillRect(translatedHead.x, translatedHead.y, 10, 10);

    ctx.fillStyle = "blue";
    ctx.fillRect(leftEye.x-5, leftEye.y-5, 10, 10);
    ctx.fillRect(rightEye.x-5, rightEye.y-5, 10, 10);
    */

    if(this.active) {

    	this.catReveal += (312 - this.catReveal) * 0.25;
    	
    	if(this.catReveal > 311) {
    		this.catReveal = 312;
    		this.transition = false;
    	}
    	
      if(this.shoot) {
        this.laserGain += (1 - this.laserGain) * 0.3;
        this.alpha += (0.5 - this.alpha) * 0.7;
      } else {
        this.laserGain += (0.0 - this.laserGain) * 0.1;
        this.alpha += (0 - this.alpha) * 0.3;
      }
	  
	  var i = 0;

      for(var i = 0; i < 3; i++) {
        
        var r = 255;
        var b = Math.floor(Math.random() * r);

        ctx.strokeStyle = "rgba(" + r + ", " + b + ", 15, " + this.alpha + ")";

        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(leftEye.x, leftEye.y, Math.random() * 20+5, 0, 2 * Math.PI);
        ctx.arc(rightEye.x, rightEye.y, Math.random() * 20+5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.lineWidth = Math.random() * 15 + 3;
        ctx.beginPath();
        
        ctx.moveTo(leftEye.x, leftEye.y);
        ctx.lineTo(this.target.x + Math.random() * 20 - 10, this.target.y + Math.random() * 20 - 10);

        ctx.moveTo(rightEye.x, rightEye.y);
        ctx.lineTo(this.target.x + Math.random() * 20 - 10, this.target.y + Math.random() * 20 - 10);
        ctx.stroke();
      }
				
      for(i = 0; i < 30; i++) {
		  
        ctx.strokeStyle = "rgba(" + r + ", " + b + ", 15, " + this.alpha + ")";

        ctx.lineWidth = Math.random() * 5 + 1;
        ctx.beginPath();        
        ctx.moveTo(this.target.x, this.target.y);
        ctx.lineTo(this.target.x + Math.random() * 200 - 100, this.target.y + Math.random() * 200 - 100);
        ctx.stroke();
      }

      for(i = 0; i < 8; i++){
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(this.target.x + Math.random() * 60 - 30, this.target.y + Math.random() * 60 - 30, Math.random() * 30 + 5, 0, 2 * Math.PI);
        ctx.fill();
      }

      var self = this;
      requestAnimationFrame(function() {
      	self.animate();
      });

    } else {
      this.laserGain += (0 - this.laserGain) * 0.1;
    	if(this.catReveal > 0.5) {
    		this.catReveal += (0 - this.catReveal) * 0.1;
    		
    		var self = this;
	      
        requestAnimationFrame(function() {
	      	self.animate();
	      });

    	} else {
        this.sounds.shutdown();
    		this.cleanUp();
    		this.transition = false;
    		this.catReveal = 0;
    	}
    }
    if(this.sounds.isLoaded() && (this.laserLoop != null)){
      this.laserLoop.setGain(this.laserGain);
    }
  };


LaserCat.prototype.cleanUp = function() {
	document.body.removeChild(this.canvas);
}

LaserCat.prototype.toggle = function() {
	if(this.transition){
		return;
	}
  

	this.transition = true;
	this.active = !this.active;
	if(this.active) {
    
   // if(!this.sounds.isLoaded()){
      var self = this;
      this.sounds.initialize(function() {
        self.sounds.playSound("meow");
        self.laserLoop = self.sounds.getSound("laserBeam");
        self.laserLoop.setGain(0.0);
        self.laserLoop.start(0);
      });
		
    this.makeStuff();
		this.resize();
	} else {
		this.active = false;
    this.sounds.playSound("meow");
	}
}

var laserCatamu = new LaserCat();
