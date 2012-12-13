/***********************************************************************
 * global
 **********************************************************************/
const TWOPI = Math.PI * 2;
const HALFPI = Math.PI / 2;
const HALFPIX3 = 3*HALFPI;
const PISQUARED = square(Math.PI * Math.PI);

function vehicleSimulation(canvas) {
  world = new World(canvas);
}

//maybe with a transform matrix some day
function rotateAroundPoint(x,y,rx,ry,angle) {
  x -= rx;
  y -= ry;
  x = x * Math.cos(angle) - y * Math.sin(angle);
  y = y * Math.cos(angle) + x * Math.sin(angle);
  x += rx;
  y += ry
  return new Vec2D(x,y);
}

function angle_between(p1, p2) {
  var dx = p2.x - p1.x;
  var dy = p2.y - p1.y;
  return Math.atan2(dy, dx);
}

function distance_between(p1, p2) {
  var dx = p2.x - p1.x;
  var dy = p2.y - p1.y;
  return Math.sqrt(square(dx) + square(dy));
}

//normalize angles outside 0-2PI back into range.
function normalize_angle(angle) {
  var newangle = angle;
  if (angle > TWOPI) {
    newangle = normalize_angle(angle - TWOPI);
  }
  else if (angle < 0) {
    newangle = normalize_angle(angle + TWOPI);
  }
  return newangle;
}

function square(x) {
  return x*x;
}

// scales any value from one range to another
function scale(value, inlo, inhi, outlo, outhi) {
  var inrange = inhi - inlo;
  var outrange = outhi - outlo;
  if (inrange == 0) return 0;
  return outlo + (((value-inlo)*outrange)/inrange);
}

function clip(value, lo, hi) {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}
/***********************************************************************
 * Vec2D
 **********************************************************************/
function Vec2D (x,y) {
  this.x = x;
  this.y = y;
}

/***********************************************************************
 * Canvas
 **********************************************************************/
function Canvas(elementId) {
  this.canvas=document.getElementById(elementId);
  this.canvas.style.border = "black 1px solid";
  this.ctx=this.canvas.getContext("2d");
  this.width = parseInt(this.canvas.width);
  this.height = parseInt(this.canvas.height);
  this.diagonal = Math.sqrt(square(this.width) + square(this.height));
  this.diagonal_squared = square(this.diagonal);
  this.rect = this.canvas.getBoundingClientRect();
  this.mouseX = 0;
  this.mouseY = 0;
  this.dragThis = null;

  //the special 'this' will be reassigned to the context of the event generator
  //shadowing the 'this' we have now. Binding it to _this gets around it.
  var _this = this;
  this.canvas.addEventListener('mousemove', function(evt) { _this.mouseMoveListener(evt); }, false);
  this.canvas.addEventListener('mouseup', function(evt) { _this.mouseUpListener(evt); }, false);
}

Canvas.prototype.mouseMoveListener = function (evt) {
  var root = document.documentElement;
  this.mouseX = evt.clientX - this.rect.top - root.scrollTop;
  this.mouseY = evt.clientY - this.rect.left - root.scrollLeft;
}

Canvas.prototype.mouseUpListener = function (evt) {
    this.dragThis = null;
}

Canvas.prototype.clear = function() {
  this.ctx.clearRect(0, 0, this.width, this.height);
}

/***********************************************************************
 * Vehicle
 **********************************************************************/
function Vehicle(canvas,gains,color,posx,posy, orientation) {
  this.canvas = canvas;
  this.gains = gains;
  this.color = color;
  this.dim = new Vec2D(16, 16);
//  this.pos = new Vec2D(this.canvas.width/2, this.canvas.height/2);
  this.pos = new Vec2D(posx,posy);
  this.orientation = orientation;
  this.wheels = {left:  {pos: this.calcWheelPos(this.dim.y/2),
                         angvel: 0.0},
                 right: {pos: this.calcWheelPos(-this.dim.y/2),
                         angvel: 0.0}};

  //the special 'this' will be reassigned to the context of the event generator
  //shadowing the 'this' we have now. Binding it to _this gets around it.
  var _this = this;
  this.canvas.canvas.addEventListener('mousedown', function(evt) { _this.mouseDownListener(evt); }, false);
  this.canvas.canvas.addEventListener('mousewheel', function(evt) { _this.mouseWheelListener(evt); }, false);
}

Vehicle.prototype.mouseDownListener = function (evt) {
  if ((Math.abs(this.pos.x - this.canvas.mouseX) < this.dim.x/2) &&
      (Math.abs(this.pos.y - this.canvas.mouseY) < this.dim.y/2)) {
    if (this.canvas.dragThis == null) {
      this.canvas.dragThis = this;
    }
  }
}

Vehicle.prototype.mouseWheelListener = function (evt) {
  if (this.canvas.dragThis == this) {
    this.orientation = normalize_angle(this.orientation + (evt.wheelDelta / 500.0));
  }
}

Vehicle.prototype.calcWheelPos = function(offset) {
   return new Vec2D(this.pos.x + offset * Math.sin(this.orientation),
                this.pos.y + offset * Math.cos(this.orientation));
}

Vehicle.prototype.setSpeed = function(left_speed, right_speed) {
  this.wheels.left.angvel = -left_speed;
  //wheel rotation flips when turning around the right side.
  this.wheels.right.angvel = right_speed;
}

Vehicle.prototype.boundsCheck = function() {
  var padding = Math.max(this.dim.x, this.dim.y)/2;
  if (this.pos.x < -padding) this.pos.x = this.canvas.width+padding;
  if (this.pos.x > this.canvas.width+padding) this.pos.x = -padding;
  if (this.pos.y < -padding) this.pos.y = this.canvas.height+padding;
  if (this.pos.y > this.canvas.height+padding) this.pos.y = -padding;
}

Vehicle.prototype.withinBounds = function() {
  var padding = Math.max(this.dim.x, this.dim.y)/2;
  return (this.pos.x > padding &&
          this.pos.x < (640-padding) &&
          this.pos.y > padding &&
          this.pos.y < (480-padding));
}

Vehicle.prototype.calcInfluence = function(wheelpos, beaconpos) {
  var max_dist = this.canvas.diagonal;
  var max_dist_sq = this.canvas.diagonal_squared;

  //this yields angles relative to the orientation of the vehicle.
  // 0 or 2PI behind, 0.5PI left, PI ahead, 1.5PI right
  var angle = normalize_angle(angle_between(wheelpos, beaconpos) + this.orientation);
  var dist = distance_between(wheelpos, beaconpos);

  var mid_angle = HALFPI - Math.abs(clip(angle, HALFPI, HALFPIX3) - Math.PI);
  var angle_influence = scale(mid_angle, 0, HALFPI, 0.0, 1.0);
  var dist_influence = scale(square(max_dist - dist), 0, max_dist_sq, 0.1, 1);

  return angle_influence * dist_influence;
}

Vehicle.prototype.calcVelocity = function(vehicles) {
  var left = 0.0;
  var right = 0.0;
  var max_influence = 0.0;
  for (var i=0;i<vehicles.length;i++) {
    var vehicle = vehicles[i];
    if (vehicle != this) {
      max_influence += 1;

      var left_influence = this.calcInfluence(this.wheels.left.pos, vehicle.pos);
      var right_influence  = this.calcInfluence(this.wheels.right.pos, vehicle.pos);

      var gain = this.gains[vehicle.color][this.color];
      left += (left_influence * gain.l2l) + (right_influence * gain.r2l);
      right += (left_influence * gain.l2r) + (right_influence * gain.r2r);
    }
  }
  //normalize to a reasonable speed regardless of number of beacons
  if (max_influence > 0.0) {
    this.setSpeed(0.05*(left/max_influence),0.05*(right/max_influence));
  }
  else { //circle around when there are no beacons.
    this.setSpeed(0.015, 0.01);
  }
}

Vehicle.prototype.update = function() {
  if (this.canvas.dragThis == this) {
    this.pos.x = this.canvas.mouseX;
    this.pos.y = this.canvas.mouseY;
  }
  else {
    this.orientation = normalize_angle(this.orientation + this.wheels.left.angvel + this.wheels.right.angvel);

    //rotate around left wheel
    this.pos = rotateAroundPoint(this.pos.x, this.pos.y, this.wheels.left.pos.x, this.wheels.left.pos.y, this.wheels.left.angvel);
    //rotate around right wheel, where it was before the left wheel rotation
    this.pos = rotateAroundPoint(this.pos.x, this.pos.y, this.wheels.right.pos.x, this.wheels.right.pos.y, this.wheels.right.angvel);
    this.boundsCheck();
  }
  //now update the wheel positions
  this.wheels.left.pos = this.calcWheelPos(this.dim.y/2);
  this.wheels.right.pos = this.calcWheelPos(-this.dim.y/2);
}

Vehicle.prototype.draw = function() {
  this.canvas.ctx.save();
  this.canvas.ctx.translate(this.pos.x, this.pos.y);
  this.canvas.ctx.rotate(-this.orientation);
  this.canvas.ctx.beginPath();
  this.canvas.ctx.moveTo(this.dim.x, this.dim.y);
  this.canvas.ctx.lineTo(this.dim.x, -this.dim.y);
  this.canvas.ctx.lineTo(-this.dim.x, 0);
  this.canvas.ctx.lineTo(this.dim.x, this.dim.y);
  this.canvas.ctx.fillStyle = this.color;
  this.canvas.ctx.fill();
  this.canvas.ctx.closePath();
  this.canvas.ctx.restore();

  this.canvas.ctx.save();
  this.canvas.ctx.translate(this.wheels.left.pos.x, this.wheels.left.pos.y);
  this.canvas.ctx.rotate(-this.orientation);
  this.canvas.ctx.fillStyle = "#909090";
  this.canvas.ctx.fillRect(-8,-2,16,4);
  this.canvas.ctx.restore();

  this.canvas.ctx.save();
  this.canvas.ctx.translate(this.wheels.right.pos.x, this.wheels.right.pos.y);
  this.canvas.ctx.rotate(-this.orientation);
  this.canvas.ctx.fillStyle = "#707070";
  this.canvas.ctx.fillRect(-8,-2,16,4);
  this.canvas.ctx.restore();

}

/***********************************************************************
 * Beacon
 **********************************************************************/
function Beacon(canvas, color, x, y, dimx, dimy) {
  this.canvas = canvas;
  this.color = color;
  this.pos = new Vec2D(x,y);
  this.dim = new Vec2D(dimx,dimy);
  this.enabled = false;
  this.attract = true;
  this.cross = false;

  //the special 'this' will be reassigned to the context of the event generator
  //shadowing the 'this' we have now. Binding it to _this gets around it.
  var _this = this;
  //Event Listeners
  this.canvas.canvas.addEventListener('mousedown', function(evt) { _this.mouseDownListener(evt); }, false);

  var onoffbox = document.getElementById(color + "-onoff");
  var attractopt = document.getElementById(color + "-attract");
  var repelopt = document.getElementById(color + "-repel");
  var crossbox = document.getElementById(color + "-cross");
  if (onoffbox) {
    onoffbox.addEventListener("click", function(evt) { _this.enabled = evt.target.checked; }, false);
    attractopt.addEventListener("click", function(evt) { _this.attract = true; }, false);
    repelopt.addEventListener("click", function(evt) { _this.attract = false; }, false);
    crossbox.addEventListener("click", function(evt) { _this.cross = evt.target.checked; }, false);
  }
}

Beacon.prototype.mouseDownListener = function (evt) {
  if (this.enabled) {
    if ((Math.abs(this.pos.x - this.canvas.mouseX) < this.dim.x/2) &&
        (Math.abs(this.pos.y - this.canvas.mouseY) < this.dim.y/2)) {
      if (this.canvas.dragThis == null) {
        this.canvas.dragThis = this;
      }
    }
  }
}

Beacon.prototype.update = function() {
  if (this.enabled && this.canvas.dragThis == this) {
    this.pos.x = this.canvas.mouseX;
    this.pos.y = this.canvas.mouseY;
  }
}

Beacon.prototype.draw = function() {
  if (this.enabled) {
    var size = this.size;
    this.canvas.ctx.save();
    this.canvas.ctx.translate(this.pos.x, this.pos.y);
    this.canvas.ctx.fillStyle = this.color;
    this.canvas.ctx.fillRect(-size/2,-size/2,size,size);
    this.canvas.ctx.fillRect(-this.dim.x/2,-this.dim.y/2,this.dim.x,this.dim.y);
    this.canvas.ctx.restore();
  }
}

/***********************************************************************
 * World
 **********************************************************************/
function World(canvas, rate) {
  var _this = this;
  var gains = {"red":  {"red":   {l2l:0.1, l2r:0.1, r2l:0.1, r2r:0.2},
                        "green": {l2l:1, l2r:1, r2l:1, r2r:1},
                        "blue":  {l2l:1, l2r:1, r2l:1, r2r:1}},
               "green":{"red":   {l2l:1, l2r:1, r2l:1, r2r:1},
                        "green": {l2l:1, l2r:1, r2l:1, r2r:1},
                        "blue":  {l2l:1, l2r:1, r2l:1, r2r:1}},
               "blue": {"red":   {l2l:1, l2r:1, r2l:1, r2r:1},
                        "green": {l2l:1, l2r:1, r2l:1, r2r:1},
                        "blue":  {l2l:1, l2r:1, r2l:1, r2r:1}}};

  this.canvas = canvas;
  this.vehicles  = [new Vehicle(canvas, gains, "red",  this.randCoord(canvas.width), this.randCoord(canvas.height), this.randOrient()),
                    //new Vehicle(canvas, gains, "red",  this.randCoord(canvas.width), this.randCoord(canvas.height), this.randOrient()),
                    new Vehicle(canvas, gains, "red",  this.randCoord(canvas.width), this.randCoord(canvas.height), this.randOrient()) ];
  setInterval(function(){_this.step();},rate);
}

World.prototype.randOrient = function() {
  return (Math.random() * TWOPI);
}

World.prototype.randCoord = function(dim) {
  var quarter = dim / 4;
  return quarter + (Math.random() * quarter * 2);
}

World.prototype.step = function() {
  this.canvas.clear();
  //maximum wheel speed of 0.05
  var left = 0.015;//parseInt(document.getElementById("left").value) / 1000.0;
  var right = 0.01;//parseInt(document.getElementById("right").value) / 1000.0;

  for (var i=0;i<this.vehicles.length;i++) {
    var vehicle = this.vehicles[i];
    vehicle.calcVelocity(this.vehicles);
    vehicle.update();
    vehicle.draw();
  }
}

