/***********************************************************************
 * global
 **********************************************************************/
const TWOPI = Math.PI * 2;
const PISQUARED = Math.PI * Math.PI;
const MAX_DIST = distance_between(new Vec2D(0,0), new Vec2D(640,480));

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

function normalize_angle(angle) {
  var newangle = angle;
  if (angle > Math.PI) {
    newangle = normalize_angle(angle - TWOPI);
  }
  else if (angle < -Math.PI) {
    newangle = normalize_angle(angle + TWOPI);
  }
  return newangle;
}

function square(x) {
  return x*x;
}

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
  this.rect = this.canvas.getBoundingClientRect();
  this.mouseX = 0;
  this.mouseY = 0;

  var _this = this; //javascript dumbness
  this.canvas.addEventListener('mousemove', function(evt) { _this.mouseMoveListener(evt); }, false);
}

Canvas.prototype.mouseMoveListener = function (evt) {
  var root = document.documentElement;
  this.mouseX = evt.clientX - this.rect.top - root.scrollTop;
  this.mouseY = evt.clientY - this.rect.left - root.scrollLeft;
}

Canvas.prototype.clear = function() {
  this.ctx.clearRect(0, 0, this.width, this.height);
}

/***********************************************************************
 * Vehicle
 **********************************************************************/
function Vehicle(canvas,dimx,dimy) {
  this.canvas = canvas;
  this.dim = new Vec2D(dimx, dimy);
  this.pos = new Vec2D(this.canvas.width/2, this.canvas.height/2);
  this.orientation = 0.0;
  this.wheels = {left:  {pos: this.calcWheelPos(this.dim.y/2),
                         angvel: 0.0},
                 right: {pos: this.calcWheelPos(-this.dim.y/2),
                         angvel: 0.0}};
  this.dragMe = false;
  var _this = this; //javascript dumbness
  this.canvas.canvas.addEventListener('mousedown', function(evt) { _this.mouseDownListener(evt); }, false);
  this.canvas.canvas.addEventListener('mouseup', function(evt) { _this.mouseUpListener(evt); }, false);
  this.canvas.canvas.addEventListener('mousewheel', function(evt) { _this.mouseWheelListener(evt); }, false);
}

Vehicle.prototype.mouseDownListener = function (evt) {
  if ((Math.abs(this.pos.x - this.canvas.mouseX) < this.dim.x/2) &&
      (Math.abs(this.pos.y - this.canvas.mouseY) < this.dim.y/2)) {
    this.dragMe = true;
  }
}

Vehicle.prototype.mouseUpListener = function (evt) {
    this.dragMe = false;
}

Vehicle.prototype.mouseWheelListener = function (evt) {
  if(this.dragMe) {
    this.orientation += evt.wheelDelta / 10.0;
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

Vehicle.prototype.withinBounds = function() {
  padding = Math.max(this.dim.x, this.dim.y)/2;
  return (this.pos.x > padding &&
          this.pos.x < (640-padding) &&
          this.pos.y > padding &&
          this.pos.y < (480-padding));
}

Vehicle.prototype.calcVelocity = function(beacons) {
/* TODO
 - calculate the speed based on the angles of the wheels to the object
 - add up all the speeds from angles with all objects
 - normalize these values to some nominal speed
*/
  var left = 0.0;
  var right = 0.0;
  var max_influence = 0.0;
  for (var i=0;i<beacons.length;i++) {
    var beacon = beacons[i];
    if (beacon.enabled) {
      max_influence += MAX_DIST;
      var attract_factor = (beacon.attract ? 1 : -1);
      var left_angle = normalize_angle(angle_between(this.wheels.left.pos, beacon.pos) - this.orientation);
      var right_angle = normalize_angle(angle_between(this.wheels.right.pos, beacon.pos) - this.orientation);
      var left_dist = distance_between(this.wheels.left.pos, beacon.pos);
      var right_dist = distance_between(this.wheels.right.pos, beacon.pos);
      //and now the tricky part; to determine the influence of a sensor on a wheel based on the distance and angle to it.
      // because the whole point is to have two sensors each drive a wheel independently, it is important to not mix left and right.
      // sensing would be strongest when close and head on.
      var left_influence =  left_dist;
      var right_influence = right_dist;
      if (beacon.cross) {
        left += left_influence * attract_factor;
        right += right_influence * attract_factor;
      }
      else {
        right += left_influence * attract_factor;
        left += right_influence * attract_factor;
      }
    }
  }
  if (max_influence > 0.0) {
    this.setSpeed(0.05*(left/max_influence),0.05*(right/max_influence));
  }
  else {
    this.setSpeed(0.015, 0.01);
  }
}

Vehicle.prototype.update = function() {
  if (this.dragMe) {
    this.pos.x = this.canvas.mouseX;
    this.pos.y = this.canvas.mouseY;
  }
  else {
    if (this.withinBounds()) {
      this.orientation = normalize_angle(this.orientation + this.wheels.left.angvel + this.wheels.right.angvel);

      //rotate around left wheel
      this.pos = rotateAroundPoint(this.pos.x, this.pos.y, this.wheels.left.pos.x, this.wheels.left.pos.y, this.wheels.left.angvel);
      //rotate around right wheel, where it was before the left wheel rotation
      this.pos = rotateAroundPoint(this.pos.x, this.pos.y, this.wheels.right.pos.x, this.wheels.right.pos.y, this.wheels.right.angvel);
    }
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
  this.dragMe = false;
  this.enabled = false;
  this.attract = true;
  this.cross = false;

  //Event Listeners
  var _this = this; //javascript dumbness
  this.canvas.canvas.addEventListener('mousedown', function(evt) { _this.mouseDownListener(evt); }, false);
  this.canvas.canvas.addEventListener('mouseup', function(evt) { _this.mouseUpListener(evt); }, false);

  var onoffbox = document.getElementById(color + "-onoff");
  var attractopt = document.getElementById(color + "-attract");
  var repelopt = document.getElementById(color + "-repel");
  var crossbox = document.getElementById(color + "-cross");
  onoffbox.addEventListener("click", function(evt) { _this.enabled = evt.target.checked; }, false);
  attractopt.addEventListener("click", function(evt) { _this.attract = true; }, false);
  repelopt.addEventListener("click", function(evt) { _this.attract = false; }, false);
  crossbox.addEventListener("click", function(evt) { _this.cross = evt.target.checked; }, false);
}

Beacon.prototype.mouseDownListener = function (evt) {
  if (this.enabled) {
    if ((Math.abs(this.pos.x - this.canvas.mouseX) < this.dim.x/2) &&
        (Math.abs(this.pos.y - this.canvas.mouseY) < this.dim.y/2)) {
      this.dragMe = true;
    }
  }
}

Beacon.prototype.mouseUpListener = function (evt) {
    this.dragMe = false;
}

Beacon.prototype.update = function() {
  if (this.enabled && this.dragMe) {
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
  var self = this;
  this.vehicles = [new Vehicle(canvas, 16, 16)];
  this.beacons = [new Beacon(canvas, "red",   50, 40, 16, 16),
                  new Beacon(canvas, "green", 100,40, 16, 16),
                  new Beacon(canvas, "blue",  150,40, 16, 16) ];
  this.canvas = canvas;
  setInterval(function(){self.step();},rate);
}

World.prototype.step = function() {
  this.canvas.clear();
  //maximum wheel speed of 0.05
  var left = 0.015;//parseInt(document.getElementById("left").value) / 1000.0;
  var right = 0.01;//parseInt(document.getElementById("right").value) / 1000.0;

  for (var i=0;i<this.beacons.length;i++) {
    var beacon = this.beacons[i];
    beacon.update();
    beacon.draw();
  }
  for (var i=0;i<this.vehicles.length;i++) {
    var vehicle = this.vehicles[i];
    vehicle.calcVelocity(this.beacons);
    vehicle.update();
    vehicle.draw();
  }
}

