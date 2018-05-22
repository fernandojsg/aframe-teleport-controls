/* global THREE, AFRAME, Element  */
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
    button: {default: 'trackpad', oneOf: ['trackpad', 'trigger', 'grip', 'menu']},
    startEvents: {type: 'array'},
    endEvents: {type: 'array'},
    collisionEntities: {default: ''},
    hitEntity: {type: 'selector'},
    cameraRig: {type: 'selector'},
    teleportOrigin: {type: 'selector'},
    hitCylinderColor: {type: 'color', default: '#99ff99'},
    hitCylinderRadius: {default: 0.25, min: 0},
    hitCylinderHeight: {default: 0.3, min: 0},
    interval: {default: 0},
    maxLength: {default: 10, min: 0, if: {type: ['line']}},
    curveNumberPoints: {default: 30, min: 2, if: {type: ['parabolic']}},
    curveLineWidth: {default: 0.025},
    curveHitColor: {type: 'color', default: '#99ff99'},
    curveMissColor: {type: 'color', default: '#ff0000'},
    curveShootingSpeed: {default: 5, min: 0, if: {type: ['parabolic']}},
    defaultPlaneSize: { default: 100 },
    landingNormal: {type: 'vec3', default: { x: 0, y: 1, z: 0 }},
    landingMaxAngle: {default: '45', min: 0, max: 360},
    drawIncrementally: {default: false},
    incrementalDrawMs: {default: 700},
    missOpacity: {default: 1.0},
    hitOpacity: {default: 1.0}
  },

  init: function () {
    var data = this.data;
    var el = this.el;
    var teleportEntity;
    var i;

    this.active = false;
    this.obj = el.object3D;
    this.hitPoint = new THREE.Vector3();
    this.rigWorldPosition = new THREE.Vector3();
    this.newRigWorldPosition = new THREE.Vector3();
    this.teleportEventDetail = {
      oldPosition: this.rigWorldPosition,
      newPosition: this.newRigWorldPosition,
      hitPoint: this.hitPoint
    };

    this.hit = false;
    this.prevCheckTime = undefined;
    this.prevHitHeight = 0;
    this.referenceNormal = new THREE.Vector3();
    this.curveMissColor = new THREE.Color();
    this.curveHitColor = new THREE.Color();
    this.raycaster = new THREE.Raycaster();

    this.defaultPlane = createDefaultPlane(this.data.defaultPlaneSize);
    this.defaultCollisionMeshes = [this.defaultPlane];

    teleportEntity = this.teleportEntity = document.createElement('a-entity');
    teleportEntity.classList.add('teleportRay');
    teleportEntity.setAttribute('visible', false);
    el.sceneEl.appendChild(this.teleportEntity);

    this.onButtonDown = this.onButtonDown.bind(this);
    this.onButtonUp = this.onButtonUp.bind(this);
    if (this.data.startEvents.length && this.data.endEvents.length) {

      for (i = 0; i < this.data.startEvents.length; i++) {
        el.addEventListener(this.data.startEvents[i], this.onButtonDown);
      }
      for (i = 0; i < this.data.endEvents.length; i++) {
        el.addEventListener(this.data.endEvents[i], this.onButtonUp);
      }
    } else {
      el.addEventListener(data.button + 'down', this.onButtonDown);
      el.addEventListener(data.button + 'up', this.onButtonUp);
    }

    this.queryCollisionEntities();
  },

  update: function (oldData) {
    var data = this.data;
    var diff = AFRAME.utils.diff(data, oldData);

    // Update normal.
    this.referenceNormal.copy(data.landingNormal);

    // Update colors.
    this.curveMissColor.set(data.curveMissColor);
    this.curveHitColor.set(data.curveHitColor);


    // Create or update line mesh.
    if (!this.line ||
        'curveLineWidth' in diff || 'curveNumberPoints' in diff || 'type' in diff) {

      this.line = createLine(data);
      this.line.material.opacity = this.data.hitOpacity;
      this.line.material.transparent = this.data.hitOpacity < 1;
      this.numActivePoints = data.curveNumberPoints;
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
    var v0 = new THREE.Vector3();
    var g = -9.8;
    var a = new THREE.Vector3(0, g, 0);
    var next = new THREE.Vector3();
    var last = new THREE.Vector3();
    var quaternion = new THREE.Quaternion();
    var translation = new THREE.Vector3();
    var scale = new THREE.Vector3();
    var shootAngle = new THREE.Vector3();
    var lastNext = new THREE.Vector3();
    var auxDirection = new THREE.Vector3();
    var timeSinceDrawStart = 0;

    return function (time, delta) {
      if (!this.active) { return; }
      if (this.data.drawIncrementally && this.redrawLine){
        this.redrawLine = false;
        timeSinceDrawStart = 0;
      }
      timeSinceDrawStart += delta;
      this.numActivePoints = this.data.curveNumberPoints*timeSinceDrawStart/this.data.incrementalDrawMs;
      if (this.numActivePoints > this.data.curveNumberPoints){
        this.numActivePoints = this.data.curveNumberPoints;
      }

      // Only check for intersection if interval time has passed.
      if (this.prevCheckTime && (time - this.prevCheckTime < this.data.interval)) { return; }
      // Update check time.
      this.prevCheckTime = time;

      var matrixWorld = this.obj.matrixWorld;
      matrixWorld.decompose(translation, quaternion, scale);

      var direction = shootAngle.set(0, 0, -1)
        .applyQuaternion(quaternion).normalize();
      this.line.setDirection(auxDirection.copy(direction));
      this.obj.getWorldPosition(p0);

      last.copy(p0);

      // Set default status as non-hit
      this.teleportEntity.setAttribute('visible', true);
      this.line.material.color.set(this.curveMissColor);
      this.line.material.opacity = this.data.missOpacity;
      this.line.material.transparent = this.data.missOpacity < 1;
      this.hitEntity.setAttribute('visible', false);
      this.hit = false;

      if (this.data.type === 'parabolic') {
        v0.copy(direction).multiplyScalar(this.data.curveShootingSpeed);

        this.lastDrawnIndex = 0;
        const numPoints = this.data.drawIncrementally ? this.numActivePoints : this.line.numPoints;
        for (var i = 0; i < numPoints+1; i++) {
          var t;
          if (i == Math.floor(numPoints+1)){
            t =  numPoints / (this.line.numPoints - 1);
          }
          else {
            t = i / (this.line.numPoints - 1);
          }
          parabolicCurve(p0, v0, a, t, next);
          // Update the raycaster with the length of the current segment last->next
          var dirLastNext = lastNext.copy(next).sub(last).normalize();
          this.raycaster.far = dirLastNext.length();
          this.raycaster.set(last, dirLastNext);

          this.lastDrawnPoint = next;
          this.lastDrawnIndex = i;
          if (this.checkMeshCollisions(i, next)) { break; }

          last.copy(next);
        }
        for (var j = this.lastDrawnIndex+1; j < this.line.numPoints; j++) {
          this.line.setPoint(j, this.lastDrawnPoint);
        }
      } else if (this.data.type === 'line') {
        next.copy(last).add(auxDirection.copy(direction).multiplyScalar(this.data.maxLength));
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
      return;
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

  onButtonDown: function () {
    this.active = true;
    this.redrawLine = true;
  },

  /**
   * Jump!
   */
  onButtonUp: (function () {
    const teleportOriginWorldPosition = new THREE.Vector3();
    const newRigLocalPosition = new THREE.Vector3();
    const newHandPosition = [new THREE.Vector3(), new THREE.Vector3()]; // Left and right
    const handPosition = new THREE.Vector3();

    return function (evt) {
      if (!this.active) { return; }

      // Hide the hit point and the curve
      this.active = false;
      this.hitEntity.setAttribute('visible', false);
      this.teleportEntity.setAttribute('visible', false);

      if (!this.hit) {
        // Button released but not hit point
        return;
      }

      const rig = this.data.cameraRig || this.el.sceneEl.camera.el;
      rig.object3D.getWorldPosition(this.rigWorldPosition);
      this.newRigWorldPosition.copy(this.hitPoint);

      // If a teleportOrigin exists, offset the rig such that the teleportOrigin is above the hitPoint
      const teleportOrigin = this.data.teleportOrigin;
      if (teleportOrigin) {
        teleportOrigin.object3D.getWorldPosition(teleportOriginWorldPosition);
        this.newRigWorldPosition.sub(teleportOriginWorldPosition).add(this.rigWorldPosition);
      }

      // Always keep the rig at the same offset off the ground after teleporting
      this.newRigWorldPosition.y = this.rigWorldPosition.y + this.hitPoint.y - this.prevHitHeight;
      this.prevHitHeight = this.hitPoint.y;

      // Finally update the rigs position
      newRigLocalPosition.copy(this.newRigWorldPosition);
      if (rig.object3D.parent) {
        rig.object3D.parent.worldToLocal(newRigLocalPosition);
      }
      rig.setAttribute('position', newRigLocalPosition);

      // If a rig was not explicitly declared, look for hands and mvoe them proportionally as well
      if (!this.data.cameraRig) {
        var hands = document.querySelectorAll('a-entity[tracked-controls]');
        for (var i = 0; i < hands.length; i++) {
          hands[i].object3D.getWorldPosition(handPosition);

          // diff = rigWorldPosition - handPosition
          // newPos = newRigWorldPosition - diff
          newHandPosition[i].copy(this.newRigWorldPosition).sub(this.rigWorldPosition).add(handPosition);
          hands[i].setAttribute('position', newHandPosition[i]);
        }
      }

      this.el.emit('teleported', this.teleportEventDetail);
    };
  })(),

  /**
   * Check for raycaster intersection.
   *
   * @param {number} Line fragment point index.
   * @param {number} Next line fragment point index.
   * @returns {boolean} true if there's an intersection.
   */
  checkMeshCollisions: function (i, next) {
    // @todo We should add a property to define if the collisionEntity is dynamic or static
    // If static we should do the map just once, otherwise we're recreating the array in every
    // loop when aiming.
    var meshes;
    if (!this.data.collisionEntities) {
      meshes = this.defaultCollisionMeshes;
    } else {
      meshes = this.collisionEntities.map(function (entity) {
        return entity.getObject3D('mesh');
      }).filter(function (n) { return n; });
      meshes = meshes.length ? meshes : this.defaultCollisionMeshes;
    }

    var intersects = this.raycaster.intersectObjects(meshes, true);
    if (intersects.length > 0 && !this.hit &&
        this.isValidNormalsAngle(intersects[0].face.normal)) {
      var point = intersects[0].point;

      this.line.material.color.set(this.curveHitColor);
      this.line.material.opacity = this.data.hitOpacity;
      this.line.material.transparent= this.data.hitOpacity < 1;
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

  geometry = new THREE.PlaneBufferGeometry(size, size);
  geometry.rotateX(-Math.PI / 2);
  material = new THREE.MeshBasicMaterial({color: 0xffff00});
  return new THREE.Mesh(geometry, material);
}
