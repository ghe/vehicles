/***********************************************************************
 * global
 **********************************************************************/
var TWOPI = Math.PI * 2;
var HALFPI = Math.PI / 2;
var HALFPIX3 = 3*HALFPI;
var PISQUARED = square(Math.PI);

function vehicleSimulation(canvas, controlPanelId) {
  world = new World(canvas, controlPanelId, 1);
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

function randint(n) {
  //nifty int-cast trick to get a random integer of 0 thru (n-1)
  return (Math.random() * n) | 0;
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
  this.canvas.addEventListener('mousedown', function(evt) { _this.mouseDownListener(evt); }, false);
}

Canvas.prototype.mouseMoveListener = function (evt) {
  var root = document.documentElement;
  var rect = this.canvas.getBoundingClientRect();
  this.mouseX = evt.clientX - rect.left;
  this.mouseY = evt.clientY - rect.top;
}

Canvas.prototype.mouseUpListener = function (evt) {
  this.dragThis = null;
}

Canvas.prototype.mouseDownListener = function (evt) {
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
    //prevent page scroll while doing this
    evt.preventDefault();
    evt.returnValue = false;
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

  //orient the left sensor different from the right
  var left_right_offset = (wheelpos == this.wheels.left.pos ? 1 : -1) * (HALFPI/2);

  //this yields angles relative to the orientation of the vehicle.
  // 0 or 2PI behind, 0.5PI left, PI ahead, 1.5PI right
  var angle = normalize_angle(angle_between(wheelpos, beaconpos) + this.orientation + left_right_offset);
  var dist = distance_between(wheelpos, beaconpos);

  var mid_angle = HALFPI - Math.abs(clip(angle, HALFPI, HALFPIX3) - Math.PI);
  var angle_influence = scale(mid_angle, 0, HALFPI, 0.01, 1.0);
  var dist_influence = scale(square(max_dist - dist), 0, max_dist_sq, 0.01, 1);

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
    this.setSpeed(0.25*(left/max_influence),0.25*(right/max_influence));
  } else {
    this.setSpeed(0.0, 0.0);
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
  this.canvas.ctx.globalAlpha = 0.7;
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
 * World
 **********************************************************************/
function World(canvas, controlPanelId, rate) {
  var _this = this;
  this.canvas = canvas;
  this.controlPanelId = controlPanelId;
  this.gains = {};

  document.getElementById("apply").addEventListener("click", function(evt) { _this.vehicleUpdate(); });
  document.getElementById("avoid").addEventListener("click", function(evt) { _this.avoidExample(); });
  document.getElementById("selforganize").addEventListener("click", function(evt) { _this.selfOrganizeExample(); });
  document.getElementById("repelall").addEventListener("click", function(evt) { _this.repelAllExample(); });
  document.getElementById("lucky").addEventListener("click", function(evt) { _this.randomExample(); });

  this.repelAllExample();
  setInterval(function(){_this.step();},rate);
}


World.prototype.addVehicles = function(color) {
  var count = parseInt(document.getElementById(color).value);
  if (count > 0) {
    for (var i=0;i<count;i++) {
      this.vehicles.push(new Vehicle(this.canvas, this.gains, color, this.randCoord(this.canvas.width), this.randCoord(this.canvas.height), this.randOrient()));
    }
    return true;
  }
  return false;
}

World.prototype.vehicleUpdate = function() {
  this.vehicles = [];
  var includedColors = [];
  if (this.addVehicles("red")) includedColors.push("red");
  if (this.addVehicles("green")) includedColors.push("green");
  if (this.addVehicles("blue")) includedColors.push("blue");
  this.buildControlTable(includedColors);
}

World.prototype.randGain = function() {
  return (Math.random() * 2.0) - 1.0;
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

  for (var i=0;i<this.vehicles.length;i++) {
    var vehicle = this.vehicles[i];
    vehicle.calcVelocity(this.vehicles);
    vehicle.update();
    vehicle.draw();
  }
}

World.prototype.getGainsEntry = function (key1, key2, type) {
  if (this.gains && (key1 in this.gains) && (key2 in this.gains[key1])) {
    switch (type) {
      case "l2l" : return this.gains[key1][key2].l2l;
      case "l2r" : return this.gains[key1][key2].l2r;
      case "r2l" : return this.gains[key1][key2].r2l;
      case "r2r" : return this.gains[key1][key2].r2r;
      default: throw 'invalid gains type';
    }
  }
  return 0;
}

World.prototype.resetGains = function () {
  for (i in this.sliders) {
    var slider = this.sliders[i];
    slider.value = 0.0;
    if ("fireEvent" in slider) {
      slider.fireEvent("onchange");
    } else {
      var evt = document.createEvent("HTMLEvents");
      evt.initEvent("change", false, true);
      slider.dispatchEvent(evt);
    }
  }
}

World.prototype.ensureGainsEntry = function (key1, key2) {
  if (!this.gains) this.gains = {};
  if (!(key1 in this.gains)) this.gains[key1] = {};
  if (!(key2 in this.gains[key1])) this.gains[key1][key2] = {l2l:0, l2r:0, r2l:0, r2r:0};
  return this.gains[key1][key2];
}

World.prototype.createSlider = function (from, to, type) {
  var _this = this;
  var slider = document.createElement("input");
  function genHandler(from, to, type) {
    var gain = _this.ensureGainsEntry(from, to);
    switch (type) {
      case "l2l" : return function(evt) { gain.l2l = this.value; };
      case "l2r" : return function(evt) { gain.l2r = this.value; };
      case "r2l" : return function(evt) { gain.r2l = this.value; };
      case "r2r" : return function(evt) { gain.r2r = this.value; };
      case "straight" : return function(evt) { gain.l2l = this.value; gain.r2r = this.value; };
      case "cross"    : return function(evt) { gain.l2r = this.value; gain.r2l = this.value;  };
      default: throw 'invalid gains type';
    }
  }
  slider.setAttribute("type", "range");
  slider.min = "-1.0";
  slider.max = "1.0";
  slider.step = "0.1";
  slider.value = this.getGainsEntry(from, to, ((type == "straight") ? "l2l" : ((type == "cross") ? "l2r" : type)));
  slider.addEventListener("change", genHandler(from, to, type));

  this.sliders.push(slider);
  span = document.createElement("span");
  //span.appendChild(document.createTextNode("-1"));
  span.appendChild(slider);
  //span.appendChild(document.createTextNode("1"));
  return span;
}

World.prototype.buildControlTable = function (colors) {
  var _this = this;
  var gainsTable = document.getElementById(this.controlPanelId);
  gainsTable.innerHTML="";
  var row = gainsTable.insertRow(-1);
  row.insertCell(-1);
  var cell = row.insertCell(-1);
  cell.colSpan = 4;
  cell.appendChild(document.createTextNode("sensor to wheel gains [-1, 1]"));
  cell.align = "center";
  row = gainsTable.insertRow(-1);

  //reset button
  var button = document.createElement('button');
  button.setAttribute('type', 'button');
  button.setAttribute('id','reset');
  button.innerHTML = "reset";
  button.addEventListener("click", function(evt) { _this.resetGains(); });

  //column titles
  row.insertCell(-1).appendChild(button);
  //slidertypes = ["l2l","r2r","l2r","r2l"];
  slidertypes = ["straight","cross"];
  for (s in slidertypes) {
    row.insertCell(-1).appendChild(document.createTextNode(slidertypes[s]));
  }

  //the sliders
  this.sliders = [];
  for (r in colors) {
    for (c in colors) {
      row = gainsTable.insertRow(-1);
      cell = row.insertCell(0);
      cell.setAttribute('width', '200');
      cell.appendChild(document.createTextNode("how "));
      var span = document.createElement("span");
      span.style.color = colors[r];
      span.appendChild(document.createTextNode(colors[r]));
      cell.appendChild(span);
      cell.appendChild(document.createTextNode(" responds to "));
      span = document.createElement("span");
      span.style.color = colors[c];
      span.appendChild(document.createTextNode(colors[c]));
      cell.appendChild(span);
      for (s in slidertypes) {
        cell = row.insertCell(-1);
        cell.setAttribute('width', '10');
        cell.appendChild(this.createSlider(colors[c], colors[r], slidertypes[s]));
      }
    }
  }
}

//specifically placed circuit for a blue vehicle trying to get
// to green while avoiding red. red and green are static.
World.prototype.avoidExample = function () {
  //here the key order is "how key1 affects key2"
  this.gains = { "red":   {"red":  {l2l:0, r2r:0, l2r:0, r2l:0},
                           "green":{l2l:0, r2r:0, l2r:0, r2l:0},
                           "blue": {l2l:1, r2r:1, l2r:0, r2l:0}},
                 "green": {"red":  {l2l:0, r2r:0, l2r:0, r2l:0},
                           "green":{l2l:0, r2r:0, l2r:0, r2l:0},
                           "blue": {l2l:0, r2r:0, l2r:1, r2l:1}},
                 "blue":  {"red":  {l2l:0, r2r:0, l2r:0, r2l:0},
                           "green":{l2l:0, r2r:0, l2r:0, r2l:0},
                           "blue": {l2l:0, r2r:0, l2r:0, r2l:0}}};
  this.vehicles = [];
  for (var i=0;i<10;i++) {
    this.vehicles.push(new Vehicle(this.canvas, this.gains, "green", this.canvas.width/2, 32, this.randOrient()));
  }
  for (var i=0;i<5;i++) {
    this.vehicles.push(new Vehicle(this.canvas, this.gains, "red",
      (this.canvas.width/2) - 25 + 20 * i,
      (this.canvas.height/2) - 25 + 20 * i,
      this.randOrient()));
  }
  this.vehicles.push(new Vehicle(this.canvas, this.gains, "blue", this.canvas.width/2, this.canvas.height-32, HALFPIX3));
  document.getElementById("red").value = 10;
  document.getElementById("green").value = 5;
  document.getElementById("blue").value = 1;
  this.buildControlTable(["red","green","blue"]);
}

//attracted by your own strongly, but somewhat repelled
// by the others. Form single color cliques.
World.prototype.selfOrganizeExample = function () {
  var y = 0.9;
  var n = 0.1;
  //here the key order is "how key1 affects key2"
  this.gains = { "red":   {"red":  {l2l:0, r2r:0, l2r:y, r2l:y},
                           "green":{l2l:n, r2r:n, l2r:0, r2l:0},
                           "blue": {l2l:n, r2r:n, l2r:0, r2l:0}},
                 "green": {"red":  {l2l:n, r2r:n, l2r:0, r2l:0},
                           "green":{l2l:0, r2r:0, l2r:y, r2l:y},
                           "blue": {l2l:n, r2r:n, l2r:0, r2l:0}},
                 "blue":  {"red":  {l2l:n, r2r:n, l2r:0, r2l:0},
                           "green":{l2l:n, r2r:n, l2r:0, r2l:0},
                           "blue": {l2l:0, r2r:0, l2r:y, r2l:y}}};
  this.vehicles = [];
  for (var i=0;i<20;i++) {
    this.vehicles.push(new Vehicle(this.canvas, this.gains, "red", this.randCoord(this.canvas.width), this.randCoord(this.canvas.height), this.randOrient()));
    this.vehicles.push(new Vehicle(this.canvas, this.gains, "green", this.randCoord(this.canvas.width), this.randCoord(this.canvas.height), this.randOrient()));
    this.vehicles.push(new Vehicle(this.canvas, this.gains, "blue", this.randCoord(this.canvas.width), this.randCoord(this.canvas.height), this.randOrient()));
  }
  document.getElementById("red").value = 20;
  document.getElementById("green").value = 20;
  document.getElementById("blue").value = 20;
  this.buildControlTable(["red","green","blue"]);
}

//repelled by your own, but attracted by others: never converges
World.prototype.repelOwnExample = function () {
  var y = 0.7;
  var n = 0.7;
  //here the key order is "how key1 affects key2"
  this.gains = { "red":   {"red":  {l2l:n, r2r:n, l2r:0, r2l:0},
                           "green":{l2l:0, r2r:0, l2r:y, r2l:y},
                           "blue": {l2l:0, r2r:0, l2r:y, r2l:y}},
                 "green": {"red":  {l2l:0, r2r:0, l2r:y, r2l:y},
                           "green":{l2l:n, r2r:n, l2r:0, r2l:0},
                           "blue": {l2l:0, r2r:0, l2r:y, r2l:y}},
                 "blue":  {"red":  {l2l:0, r2r:0, l2r:y, r2l:y},
                           "green":{l2l:0, r2r:0, l2r:y, r2l:y},
                           "blue": {l2l:n, r2r:n, l2r:0, r2l:0}}};
  this.vehicles = [];
  for (var i=0;i<20;i++) {
    this.vehicles.push(new Vehicle(this.canvas, this.gains, "red", this.randCoord(this.canvas.width), this.randCoord(this.canvas.height), this.randOrient()));
    this.vehicles.push(new Vehicle(this.canvas, this.gains, "green", this.randCoord(this.canvas.width), this.randCoord(this.canvas.height), this.randOrient()));
    this.vehicles.push(new Vehicle(this.canvas, this.gains, "blue", this.randCoord(this.canvas.width), this.randCoord(this.canvas.height), this.randOrient()));
  }
  document.getElementById("red").value = 20;
  document.getElementById("green").value = 20;
  document.getElementById("blue").value = 20;
  this.buildControlTable(["red","green","blue"]);
}

//dislike everyone. starts out cool, then unconverging chaos.
//because the world wraps for motion, but not sensing, and
// sensing is directional, we do not get t spread out equilibrium
World.prototype.repelAllExample = function () {
  var y = 0.9;
  var n = 0.9;
  //here the key order is "how key1 affects key2"
  this.gains = { "red":   {"red":  {l2l:n, r2r:n, l2r:0, r2l:0},
                           "green":{l2l:n, r2r:n, l2r:0, r2l:0},
                           "blue": {l2l:n, r2r:n, l2r:0, r2l:0}},
                 "green": {"red":  {l2l:n, r2r:n, l2r:0, r2l:0},
                           "green":{l2l:n, r2r:n, l2r:0, r2l:0},
                           "blue": {l2l:n, r2r:n, l2r:0, r2l:0}},
                 "blue":  {"red":  {l2l:n, r2r:n, l2r:0, r2l:0},
                           "green":{l2l:n, r2r:n, l2r:0, r2l:0},
                           "blue": {l2l:n, r2r:n, l2r:0, r2l:0}}};
  this.vehicles = [];
  for (var i=0;i<20;i++) {
    this.vehicles.push(new Vehicle(this.canvas, this.gains, "red", this.randCoord(this.canvas.width), this.randCoord(this.canvas.height), this.randOrient()));
    this.vehicles.push(new Vehicle(this.canvas, this.gains, "green", this.randCoord(this.canvas.width), this.randCoord(this.canvas.height), this.randOrient()));
    this.vehicles.push(new Vehicle(this.canvas, this.gains, "blue", this.randCoord(this.canvas.width), this.randCoord(this.canvas.height), this.randOrient()));
  }
  document.getElementById("red").value = 20;
  document.getElementById("green").value = 20;
  document.getElementById("blue").value = 20;
  this.buildControlTable(["red","green","blue"]);
}

//a random number of vehicles with random parameters
World.prototype.randomExample = function () {
  var colors = { "red":0, "green":0, "blue":0};
  var colorKeys = Object.keys(colors);
  var count = randint(20);
  for (key1 in colors) {
    for (key2 in colors) {
      var gain = this.ensureGainsEntry(key1, key2);
      gain.l2l = this.randGain();
      gain.l2r = this.randGain();
      gain.r2l = this.randGain();
      gain.r2r = this.randGain();
    }
  }
  this.vehicles = [];
  for (var i=0;i<count;i++) {
    var color = colorKeys[randint(colorKeys.length)];
    this.vehicles.push(new Vehicle(this.canvas, this.gains, color, this.randCoord(this.canvas.width), this.randCoord(this.canvas.height), this.randOrient()));
    colors[color]++;
  }
  var usedColors = [];
  for (color in colors) {
    if (colors[color] > 0) {
      document.getElementById(color).value = colors[color];
      usedColors.push(color);
    }
  }
  this.buildControlTable(usedColors);
}

