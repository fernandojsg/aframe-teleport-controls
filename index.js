/* global THREE, AFRAME  */
var cylinderTexture = require('./lib/cylinderTexture');
var parabolicCurve = require('./lib/ParabolicCurve');
var RayCurve = require('./lib/RayCurve');

if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

if (!Element.prototype.matches) {
  Element.prototype.matches =
    Element.prototype.matchesSelector ||
    Element.prototype.mozMatchesSelector ||
    Element.prototype.msMatchesSelector ||
    Element.prototype.oMatchesSelector ||
    Element.prototype.webkitMatchesSelector ||
    function (s) {
      var matches = (this.document || this.ownerDocument).querySelectorAll(s);
      var i = matches.length;
      while (--i >= 0 && matches.item(i) !== this) { /* no-op */ }
      return i > -1;
    };
}

AFRAME.registerComponent('teleport-controls', {
  schema: {
    type: {default: 'parabolic', oneOf: ['parabolic', 'line']},
    axis: {default: 'auto', oneOf: ['left', 'right', 'up', 'down', 'auto', 'none']},
    button: {default: 'auto', oneOf: ['trackpad', 'trigger', 'grip', 'menu', 'thumbstick', 'auto']},
    collisionEntities: {default: ''},
    hitEntity: {type: 'selector'},
    cameraRig: {type: 'selector'},
    hitCylinderColor: {type: 'color', default: '#99ff99'},
    hitCylinderRadius: {default: 0.25, min: 0},
    hitCylinderHeight: {default: 0.3, min: 0},
    maxLength: {default: 10, min: 0, if: {type: ['line']}},
    curveNumberPoints: {default: 30, min: 2, if: {type: ['parabolic']}},
    curveLineWidth: {default: 0.025},
    curveHitColor: {type: 'color', default: '#99ff99'},
    curveMissColor: {type: 'color', default: '#ff0000'},
    curveShootingSpeed: {default: 5, min: 0, if: {type: ['parabolic']}},
    defaultPlaneSize: { default: 100 },
    landingNormal: {type: 'vec3', default: '0 1 0'},
    landingMaxAngle: {default: '45', min: 0, max: 360}
  },

  init: function () {
    var el = this.el;
    var teleportEntity;
    var self = this;

    this.active = false;
    this.axisIndex = 1;
    this.obj = el.object3D;
    this.hitPoint = new THREE.Vector3();
    this.hit = false;
    this.prevHeightDiff = 0;
    this.referenceNormal = new THREE.Vector3();
    this.curveMissColor = new THREE.Color();
    this.curveHitColor = new THREE.Color();
    this.raycaster = new THREE.Raycaster();
    this.controllerName = undefined;

    this.defaultPlane = createDefaultPlane(this.data.defaultPlaneSize);

    teleportEntity = this.teleportEntity = document.createElement('a-entity');
    teleportEntity.classList.add('teleportRay');
    teleportEntity.setAttribute('visible', false);
    el.sceneEl.appendChild(this.teleportEntity);

    this.buttonDownHandler = this.onButtonDown.bind(this);
    this.buttonUpHandler = this.onButtonUp.bind(this);
    this.axisMoveHandler = this.onAxisMoved.bind(this);

    el.addEventListener('controllerconnected', function(evt) {
      self.controllerName = evt.detail.name;
      self.updateAutoValues(self);
    });

    this.queryCollisionEntities();
  },

  updateAutoValues: function(self, oldData) {
    var oldButton = !!oldData ? oldData.button : self.button;
    var oldAxis = !!oldData ? oldData.axis : self.axis;
    if (self.button === 'auto') {
      if (!!self.controllerName && self.controllerName === 'windows-motion-controls') {
        self.button = 'thumbstick';
      }
      else {
        self.button = 'trackpad';
      }
    }

    if (self.axis === 'auto') {
      if (!!self.controllerName && self.controllerName === 'windows-motion-controls') {
        self.axis = 'up';
      }
      else {
        self.axis = 'none';
      }
    }

    if (self.axis !== 'none' && self.button !== 'trackpad' && self.button !== 'thumbstick') {
      self.axis = 'none';
    }

    self.updateButtonHandlers(self, oldButton, self.button);
    self.updateAxisHandler(self, oldAxis, self.axis);
    self.updateAxisIndex(self);
  },

  updateAxisHandler: function(self, oldAxis, currentAxis) {
    if (oldAxis !== currentAxis) {
      if (currentAxis === 'none') {
        self.el.removeEventListener('axismove', self.axisMoveHandler);
      }
      else {
        self.el.addEventListener('axismove', self.axisMoveHandler);
      }
    }
  },

  updateButtonHandlers: function(self, oldButton, currentButton) {
    if (oldButton != currentButton) {
      self.el.removeEventListener(oldButton + 'down', self.buttonDownHandler);
      self.el.removeEventListener(oldButton + 'up', self.buttonUpHandler);
      self.el.addEventListener(currentButton + 'down', self.buttonDownHandler);
      self.el.addEventListener(currentButton + 'up', self.buttonUpHandler);
    }
  },

  updateAxisIndex: function (self) {
    if (self.axis !== 'none') {
      // The threshold beyond which a change in axis is detected for teleportation
      var axisDeadzoneThreshold = 0.4;
      self.axisDeadzone = axisDeadzoneThreshold;

      // -1 is the leftmost range for all thumbsticks and trackpads
      if (self.axis === 'left') {
          self.axisDeadzone = -axisDeadzoneThreshold;
      }

      var windowsMotionAxisMap = {'thumbstick': {'left': 0, 'right': 0, 'up': 1, 'down': 1}, 'trackpad': {'left': 2, 'right': 2, 'up': 3, 'down': 3}};
      var viveAxisMap = {'trackpad': {'left': 0, 'right': 0, 'up': 1, 'down': 1}};
      var oculusAxisMap = {'thumbstick': {'left': 0, 'right': 0, 'up': 1, 'down': 1}};

      if (self.controllerName === 'windows-motion-controls') {
        if (self.axis === 'up') {
          self.axisDeadzone = -axisDeadzoneThreshold;
        }
        foundButton = windowsMotionAxisMap[self.button];
      }
      else if(self.controllerName === 'vive-controls') {
        if (self.axis === 'down') {
          self.axisDeadzone = -axisDeadzoneThreshold;
        }
        foundButton = viveAxisMap[self.button];
      }
      else if(self.controllerName === 'oculus-touch-controls') {
        if (self.axis === 'up') {
          self.axisDeadzone = -axisDeadzoneThreshold;
        }
        foundButton = oculusAxisMap[self.button];
      }

      // Assign the axis index if button is found
      if (!!foundButton) {
        self.axisIndex = foundButton[self.axis];
      }

      if (!foundButton || !self.axis){
        console.log("Error finding " + self.button + " or " + self.axis + " in " + self.controllerName);
      }
    }
  },

  update: function (oldData) {
    var data = this.data;
    var diff = AFRAME.utils.diff(data, oldData);

    // Update which button press (or button + axis) is used to teleport
    if (!this.axis || !this.button || 'axis' in diff || 'button' in diff) {
      this.axis = data.axis;
      this.button = data.button;
      this.updateAutoValues(this, oldData);
    }

    // Update normal.
    this.referenceNormal.copy(data.landingNormal);

    // Update colors.
    this.curveMissColor.set(data.curveMissColor);
    this.curveHitColor.set(data.curveHitColor);

    // Create or update line mesh.
    if (!this.line ||
        'curveLineWidth' in diff || 'curveNumberPoints' in diff || 'type' in diff) {
      this.line = createLine(data);
      this.teleportEntity.setObject3D('mesh', this.line.mesh);
    }

    // Create or update hit entity.
    if (data.hitEntity) {
      this.hitEntity = data.hitEntity;
    } else if (!this.hitEntity || 'hitCylinderColor' in diff || 'hitCylinderHeight' in diff ||
               'hitCylinderRadius' in diff) {
      // Remove previous entity, create new entity (could be more performant).
      if (this.hitEntity) { this.hitEntity.parentNode.removeChild(this.hitEntity); }
      this.hitEntity = createHitEntity(data);
      this.el.sceneEl.appendChild(this.hitEntity);
    }
    this.hitEntity.setAttribute('visible', false);

    if ('collisionEntities' in diff) { this.queryCollisionEntities(); }
  },

  remove: function () {
    var el = this.el;
    var hitEntity = this.hitEntity;
    var teleportEntity = this.teleportEntity;

    if (hitEntity) { hitEntity.parentNode.removeChild(hitEntity); }
    if (teleportEntity) { teleportEntity.parentNode.removeChild(teleportEntity); }

    el.sceneEl.removeEventListener('child-attached', this.childAttachHandler);
    el.sceneEl.removeEventListener('child-detached', this.childDetachHandler);
  },

  tick: (function () {
    var p0 = new THREE.Vector3();
    var quaternion = new THREE.Quaternion();
    var translation = new THREE.Vector3();
    var scale = new THREE.Vector3();
    var shootAngle = new THREE.Vector3();
    var lastNext = new THREE.Vector3();

    return function (time, delta) {
      if (!this.active) { return; }

      var matrixWorld = this.obj.matrixWorld;
      matrixWorld.decompose(translation, quaternion, scale);

      var direction = shootAngle.set(0, 0, -1)
        .applyQuaternion(quaternion).normalize();
      this.line.setDirection(direction.clone());
      p0.copy(this.obj.getWorldPosition());

      var last = p0.clone();
      var next;

      // Set default status as non-hit
      this.teleportEntity.setAttribute('visible', true);
      this.line.material.color.set(this.curveMissColor);
      this.hitEntity.setAttribute('visible', false);
      this.hit = false;

      if (this.data.type === 'parabolic') {
        var v0 = direction.clone().multiplyScalar(this.data.curveShootingSpeed);
        var g = -9.8;
        var a = new THREE.Vector3(0, g, 0);

        for (var i = 0; i < this.line.numPoints; i++) {
          var t = i / (this.line.numPoints - 1);
          next = parabolicCurve(p0, v0, a, t);
          // Update the raycaster with the length of the current segment last->next
          var dirLastNext = lastNext.copy(next).sub(last).normalize();
          this.raycaster.far = dirLastNext.length();
          this.raycaster.set(last, dirLastNext);

          if (this.checkMeshCollisions(i, next)) { break; }
          last.copy(next);
        }
      } else if (this.data.type === 'line') {
        next = last.add(direction.clone().multiplyScalar(this.data.maxLength));
        this.raycaster.far = this.data.maxLength;

        this.raycaster.set(p0, direction);
        this.line.setPoint(0, p0);

        this.checkMeshCollisions(1, next);
      }
    };
  })(),

  /**
   * Run `querySelectorAll` for `collisionEntities` and maintain it with `child-attached`
   * and `child-detached` events.
   */
  queryCollisionEntities: function () {
    var collisionEntities;
    var data = this.data;
    var el = this.el;

    if (!data.collisionEntities) {
      this.collisionEntities = [];
      return
    }

    collisionEntities = [].slice.call(el.sceneEl.querySelectorAll(data.collisionEntities));
    this.collisionEntities = collisionEntities;

    // Update entity list on attach.
    this.childAttachHandler = function childAttachHandler (evt) {
      if (!evt.detail.el.matches(data.collisionEntities)) { return; }
      collisionEntities.push(evt.detail.el);
    };
    el.sceneEl.addEventListener('child-attached', this.childAttachHandler);

    // Update entity list on detach.
    this.childDetachHandler = function childDetachHandler (evt) {
      var index;
      if (!evt.detail.el.matches(data.collisionEntities)) { return; }
      index = collisionEntities.indexOf(evt.detail.el);
      if (index === -1) { return; }
      collisionEntities.splice(index, 1);
    };
    el.sceneEl.addEventListener('child-detached', this.childDetachHandler);
  },

   onTeleport: function() {
    // Jump!

    // Hide the hit point and the curve
    this.active = false;
    this.hitEntity.setAttribute('visible', false);
    this.teleportEntity.setAttribute('visible', false);

    if (!this.hit) {
      // Button released but not hit point
      return;
    }

    // @todo Create this aux vectors outside
    if (this.data.cameraRig) {
      var cameraRigPosition = new THREE.Vector3().copy(this.data.cameraRig.getAttribute('position'));
      var newCameraRigPositionY = cameraRigPosition.y + this.hitPoint.y - this.prevHeightDiff;
      var newCameraRigPosition = new THREE.Vector3(this.hitPoint.x, newCameraRigPositionY, this.hitPoint.z);
      this.prevHeightDiff = this.hitPoint.y;
      this.data.cameraRig.setAttribute('position', newCameraRigPosition);
    } else {
      var cameraEl = this.el.sceneEl.camera.el;
      var camPosition = new THREE.Vector3().copy(cameraEl.getAttribute('position'));

      var newCamPositionY = camPosition.y + this.hitPoint.y - this.prevHeightDiff;
      var newCamPosition = new THREE.Vector3(this.hitPoint.x, newCamPositionY, this.hitPoint.z);
      this.prevHeightDiff = this.hitPoint.y;

      cameraEl.setAttribute('position', newCamPosition);

      // Find the hands and move them proportionally
      var hands = document.querySelectorAll('a-entity[tracked-controls]');
      for (var i = 0; i < hands.length; i++) {
        var position = hands[i].getAttribute('position');
        var pos = new THREE.Vector3().copy(position);
        var diff = camPosition.clone().sub(pos);
        var newPosition = newCamPosition.clone().sub(diff);
        hands[i].setAttribute('position', newPosition);
      }
    }

    this.el.emit('teleport', {
      oldPosition: camPosition,
      newPosition: newCamPosition,
      hitPoint: this.hitPoint
    });
  },

  onAxisMoved: function (evt) {
    if (this.axis === 'none') {
      return;
    }

    var axisValue = evt.detail.axis[this.axisIndex];
    var isSameSign = (axisValue * this.axisDeadzone) > 0;
    var isThresholdPassed = Math.abs(axisValue) >= Math.abs(this.axisDeadzone) && isSameSign;
    if (!this.active && isThresholdPassed) {
      this.active = true;
    }
    else if (this.active && !isThresholdPassed) {
      this.active = false;
      this.onTeleport();
    }
  },

  onButtonDown: function () {
    // If an axis is specified, then this means that teleport
    // is triggered on axis move, rather than button press
    if (this.axis !== 'none') {
      return;
    }

    this.active = true;
  },

  /**
   * Jump!
   */
  onButtonUp: function (evt) {
    if (this.active) {
      this.active = false;
      this.onTeleport();
    }
  },

  /**
   * Check for raycaster intersection.
   *
   * @param {number} Line fragment point index.
   * @param {number} Next line fragment point index.
   * @returns {boolean} true if there's an intersection.
   */
  checkMeshCollisions: function (i, next) {
    var intersects;
    var meshes;

    // Gather the meshes here to avoid having to wait for entities to iniitalize.
    meshes = this.collisionEntities.map(function (entity) {
      return entity.getObject3D('mesh');
    }).filter(function (n) { return n; });
    meshes = meshes.length ? meshes : [this.defaultPlane];

    intersects = this.raycaster.intersectObjects(meshes, true);
    if (intersects.length > 0 && !this.hit &&
        this.isValidNormalsAngle(intersects[0].face.normal)) {
      var point = intersects[0].point;

      this.line.material.color.set(this.curveHitColor);
      this.hitEntity.setAttribute('position', point);
      this.hitEntity.setAttribute('visible', true);

      this.hit = true;
      this.hitPoint.copy(intersects[0].point);

      // If hit, just fill the rest of the points with the hit point and break the loop
      for (var j = i; j < this.line.numPoints; j++) {
        this.line.setPoint(j, this.hitPoint);
      }
      return true;
    } else {
      this.line.setPoint(i, next);
      return false;
    }
  },

  isValidNormalsAngle: function (collisionNormal) {
    var angleNormals = this.referenceNormal.angleTo(collisionNormal);
    return (THREE.Math.RAD2DEG * angleNormals <= this.data.landingMaxAngle);
  },
});


function createLine (data) {
  var numPoints = data.type === 'line' ? 2 : data.curveNumberPoints;
  return new RayCurve(numPoints, data.curveLineWidth);
}

/**
 * Create mesh to represent the area of intersection.
 * Default to a combination of torus and cylinder.
 */
function createHitEntity (data) {
  var cylinder;
  var hitEntity;
  var torus;

  // Parent.
  hitEntity = document.createElement('a-entity');
  hitEntity.className = 'hitEntity';

  // Torus.
  torus = document.createElement('a-entity');
  torus.setAttribute('geometry', {
    primitive: 'torus',
    radius: data.hitCylinderRadius,
    radiusTubular: 0.01
  });
  torus.setAttribute('rotation', {x: 90, y: 0, z: 0});
  torus.setAttribute('material', {
    shader: 'flat',
    color: data.hitCylinderColor,
    side: 'double',
    depthTest: false
  });
  hitEntity.appendChild(torus);

  // Cylinder.
  cylinder = document.createElement('a-entity');
  cylinder.setAttribute('position', {x: 0, y: data.hitCylinderHeight / 2, z: 0});
  cylinder.setAttribute('geometry', {
    primitive: 'cylinder',
    segmentsHeight: 1,
    radius: data.hitCylinderRadius,
    height: data.hitCylinderHeight,
    openEnded: true
  });
  cylinder.setAttribute('material', {
    shader: 'flat',
    color: data.hitCylinderColor,
    side: 'double',
    src: cylinderTexture,
    transparent: true,
    depthTest: false
  });
  hitEntity.appendChild(cylinder);

  return hitEntity;
}

function createDefaultPlane (size) {
  var geometry;
  var material;

  // @hack: Because I can't get THREE.BufferPlane working on raycaster.
  geometry = new THREE.BoxBufferGeometry(size, 0.5, size);
  geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.25, 0));
  material = new THREE.MeshBasicMaterial({color: 0xffff00});
  return new THREE.Mesh(geometry, material);
}
