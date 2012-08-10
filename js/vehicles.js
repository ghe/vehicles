function rotateAroundPoint(x,y,rx,ry,angle) {
  x -= rx;
  y -= ry;
  x = x * Math.cos(angle) - y * Math.sin(angle);
  y = y * Math.cos(angle) + x * Math.sin(angle);
  x += rx;
  y += ry
  return new Vec2D(x,y);
}

function Vec2D (x,y) {
  this.x = x;
  this.y = y;
}

function Canvas(elementId) {
  this.canvas=document.getElementById(elementId);
  this.ctx=this.canvas.getContext("2d");
  this.width = parseInt(this.canvas.width);
  this.height = parseInt(this.canvas.height);
}

Canvas.prototype.clear = function() {
  this.ctx.clearRect(0, 0, this.width, this.height);
}

function Vehicle(canvas,dimx,dimy) {
  this.canvas = canvas;
  this.dim = new Vec2D(dimx, dimy);
  this.pos = new Vec2D(this.canvas.width/2, this.canvas.height/2);
  this.orientation = 0.0;
  this.wheels = {left:  {pos: this.calcWheelPos(this.dim.y/2),
                         angvel: 0.0},
                 right: {pos: this.calcWheelPos(-this.dim.y/2),
                         angvel: 0.0}};
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

Vehicle.prototype.update = function() {
  this.orientation += (this.wheels.left.angvel + this.wheels.right.angvel);
//  console.log("orientation:" + this.orientation + " posx:" + this.pos.x + " posy:" + this.pos.y);

  //rotate around left wheel
  this.pos = rotateAroundPoint(this.pos.x, this.pos.y, this.wheels.left.pos.x, this.wheels.left.pos.y, this.wheels.left.angvel);
  //rotate around right wheel, where it was before the left wheel rotation
  this.pos = rotateAroundPoint(this.pos.x, this.pos.y, this.wheels.right.pos.x, this.wheels.right.pos.y, this.wheels.right.angvel);
  //now update the wheel positions
  this.wheels.left.pos = this.calcWheelPos(this.dim.y/2);
  this.wheels.right.pos = this.calcWheelPos(-this.dim.y/2);
}

Vehicle.prototype.draw = function() {
  this.canvas.ctx.save();
  this.canvas.ctx.translate(this.pos.x, this.pos.y);
  this.canvas.ctx.rotate(-this.orientation);
  this.canvas.ctx.fillRect(-this.dim.x/2,-this.dim.y/2,this.dim.x,this.dim.y);
  this.canvas.ctx.restore();

  this.canvas.ctx.save();
  this.canvas.ctx.translate(this.wheels.left.pos.x, this.wheels.left.pos.y);
  this.canvas.ctx.rotate(-this.orientation);
  this.canvas.ctx.fillStyle = "#ff0000";
  this.canvas.ctx.fillRect(-8,-2,16,4);
  this.canvas.ctx.restore();

  this.canvas.ctx.save();
  this.canvas.ctx.translate(this.wheels.right.pos.x, this.wheels.right.pos.y);
  this.canvas.ctx.rotate(-this.orientation);
  this.canvas.ctx.fillStyle = "#0000ff";
  this.canvas.ctx.fillRect(-8,-2,16,4);
  this.canvas.ctx.restore();

}

function World(canvas, rate) {
  var self = this;
  this.vehicles = [new Vehicle(canvas, 64, 32)];
  this.beacons = [];
  this.canvas = canvas;
  setInterval(function(){self.step();},rate);
}

World.prototype.step = function() {
  this.canvas.clear();
  //maximum wheel speed of 0.05
  var left = parseInt(document.getElementById("left").value) / 1000.0;
  var right = parseInt(document.getElementById("right").value) / 1000.0;

  for (var i=0;i<this.vehicles.length;i++) {
    if (left && right) {
      this.vehicles[i].setSpeed(left, right);
    }
    this.vehicles[i].update();
    this.vehicles[i].draw();
  }
}

function vehicleSimulation(canvas) {
  world = new World(canvas);
}
