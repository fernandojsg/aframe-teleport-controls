/* global assert, setup, suite, test */
require('aframe');
require('../index.js');
var entityFactory = require('./helpers').entityFactory;

suite('teleport-controls component', function () {
  var cameraEl;
  var component;
  var el;
  var sceneEl;
  var rig;
  var teleportOrigin;

  setup(function (done) {
    el = entityFactory();
    sceneEl = el.sceneEl;
    sceneEl.addEventListener('camera-set-active', () => {
      cameraEl = sceneEl.camera.el;
      component = el.components['teleport-controls'];
      done();
    });

    rig = document.createElement('a-entity');
    rig.id = 'rig';
    rig.setAttribute('position', '1 2 3');

    teleportOrigin = document.createElement('a-entity');
    teleportOrigin.id = 'origin';
    teleportOrigin.setAttribute('position', '4 5 6');
    rig.appendChild(teleportOrigin);

    sceneEl.appendChild(rig);

    el.setAttribute('teleport-controls', {});
  });

  /**
   * Create delay so that geometry entities are initialized before they're torn down.
   * Else we get weird issues where geometry.data is undefined on geometry.remove caused
   * issues like `cannot read property `skipCache` of undefined`.
   */
  teardown(function (done) {
    setTimeout(() => {
      done();
    }, 50);
  });

  suite('init', function () {
    test('is not active', function () {
      assert.notOk(component.active);
    });

    test('creates teleport entity', function () {
      assert.ok(component.teleportEntity);
      assert.ok(el.sceneEl.querySelector('.teleportRay'));
      assert.notOk(component.teleportEntity.getAttribute('visible'));
    });
  });

  suite('update', function () {
    test('creates line ray', function () {
      el.setAttribute('teleport-controls', 'type', 'line');
      assert.equal(component.line.numPoints, 2);
    });

    test('creates parabolic ray', function () {
      el.setAttribute('teleport-controls', {type: 'parabolic', curveNumberPoints: 20});
      assert.equal(component.line.numPoints, 20);
    });

    test('creates default hitEntity', function () {
      assert.ok(component.hitEntity);
      assert.ok(el.sceneEl.querySelector('.hitEntity'));
      assert.ok(component.hitEntity.querySelectorAll('[geometry]').length);
    });

    test('makes hitEntity invisible', function () {
      assert.notOk(component.hitEntity.getAttribute('visible'));
    });

    test('accepts given hitEntity', function () {
      var box = document.createElement('a-entity');
      box.setAttribute('id', 'box');
      el.sceneEl.appendChild(box);
      el.setAttribute('teleport-controls', 'hitEntity', '#box');
      assert.equal(component.hitEntity, box);
    });

    test('does not create duplicate hitEntities', function (done) {
      el.setAttribute('teleport-controls', 'hitCylinderRadius', 0.75);
      setTimeout(() => {
        assert.equal(el.sceneEl.querySelectorAll('.hitEntity').length, 1);
        done();
      });
    });

    test('sets landingNormal', function () {
      el.setAttribute('teleport-controls', 'landingNormal', '0 0.8 0');
      assert.equal(component.referenceNormal.y, 0.8);
    });

    test('sets curve colors', function () {
      el.setAttribute('teleport-controls', 'curveMissColor', '#FF0000');
      el.setAttribute('teleport-controls', 'curveHitColor', '#00FF00');
      assert.equal(component.curveMissColor.r, 1);
      assert.equal(component.curveHitColor.g, 1);
    });
  });

  suite('remove', function () {
    test('removes teleportEntity', function () {
      assert.ok(el.sceneEl.querySelector('.teleportRay'));
      el.parentNode.removeChild(el);
      assert.notOk(el.sceneEl.querySelector('.teleportRay'));
    });

    test('removes hitEntity', function () {
      assert.ok(el.sceneEl.querySelector('.hitEntity'));
      el.parentNode.removeChild(el);
      assert.notOk(el.sceneEl.querySelector('.hitEntity'));
    });
  });

  suite('onButtonDown', function () {
    test('sets active', function () {
      assert.notOk(component.active);
      component.onButtonDown();
      assert.ok(component.active);
    });
  });

  suite('onButtonUp', function () {
    setup(function () {
      component.active = true;
      component.hit = true;
    });

    test('unsets active', function () {
      component.onButtonUp();
    });

    test('hides teleport ray and entity', function () {
      var hitEntity = el.sceneEl.querySelector('.hitEntity');
      var teleportEntity = el.sceneEl.querySelector('.teleportRay');
      hitEntity.setAttribute('visible', true);
      teleportEntity.setAttribute('visible', true);
      component.onButtonUp();
      assert.notOk(hitEntity.getAttribute('visible'));
      assert.notOk(teleportEntity.getAttribute('visible'));
    });

    test('teleports camera', function () {
      component.hitPoint = {x: 10, y: 20, z: 30};
      component.onButtonUp();
      assert.shallowDeepEqual(cameraEl.getAttribute('position'), {x: 10, y: 21.6, z: 30});
    });

    test('teleports rig', function () {
      el.setAttribute('teleport-controls', 'cameraRig', '#rig');

      component.hitPoint = {x: 10, y: 20, z: 30};
      component.onButtonUp();
      assert.shallowDeepEqual(rig.getAttribute('position'), {x: 10, y: 22, z: 30});
    });

    test('teleports rig relative to teleportOrigin', function () {
      el.setAttribute('teleport-controls', 'cameraRig', '#rig');
      el.setAttribute('teleport-controls', 'teleportOrigin', '#origin');

      component.hitPoint = {x: 10, y: 20, z: 30};
      component.onButtonUp();
      assert.shallowDeepEqual(rig.getAttribute('position'), {x: 6, y: 22, z: 24});
      assert.shallowDeepEqual(teleportOrigin.getAttribute('position'), {x: 4, y: 5, z: 6});
    });

    test('teleports tracked-controls', function (done) {
      var hand = document.createElement('a-entity');
      hand.setAttribute('tracked-controls', '');
      sceneEl.appendChild(hand);
      hand.addEventListener('loaded', () => {
        component.hitPoint = {x: 10, y: 20, z: 30};
        component.onButtonUp();
        assert.shallowDeepEqual(hand.getAttribute('position'), {x: 10, y: 20, z: 30});
        done();
      });
    });

    test('emits event', function (done) {
      el.addEventListener('teleport', evt => {
        assert.shallowDeepEqual(evt.detail.oldPosition, {x: 0, y: 1.6, z: 0});
        assert.shallowDeepEqual(evt.detail.newPosition, {x: 10, y: 21.6, z: 30});
        assert.shallowDeepEqual(evt.detail.hitPoint, {x: 10, y: 20, z: 30});
        done();
      });
      component.hitPoint = {x: 10, y: 20, z: 30};
      component.onButtonUp();
    });
  });

  suite('queryCollisionEntities', function () {
    setup(function () {
      var collisionEls = this.collisionEls = [];
      for (var i = 0; i < 3; i++) {
        collisionEls.push(document.createElement('a-entity'));
        collisionEls[i].setAttribute('class', 'teleportable');
        collisionEls[i].setAttribute(`data-teleport-${i}`, i);
        sceneEl.appendChild(collisionEls[i]);
      }
    });

    test('grabs all from class', function () {
      assert.equal(component.collisionEntities.length, 0);
      el.setAttribute('teleport-controls', 'collisionEntities', '.teleportable');
      assert.equal(component.collisionEntities.length, 3);
      assert.ok(component.collisionEntities.indexOf(this.collisionEls[0]) !== -1);
      assert.ok(component.collisionEntities.indexOf(this.collisionEls[1]) !== -1);
      assert.ok(component.collisionEntities.indexOf(this.collisionEls[2]) !== -1);
    });

    test('handles dynamically added entity to set', function (done) {
      var newEl;
      assert.equal(component.collisionEntities.length, 0);
      el.setAttribute('teleport-controls', 'collisionEntities', '.teleportable');
      assert.equal(component.collisionEntities.length, 3);

      newEl = document.createElement('a-entity');
      newEl.setAttribute('class', 'teleportable');

      sceneEl.addEventListener('child-attached', () => {
        assert.equal(component.collisionEntities.length, 4);
        assert.ok(component.collisionEntities.indexOf(newEl) !== -1);
        done();
      });
      sceneEl.appendChild(newEl);
    });

    test('handles dynamically removed entity from set', function (done) {
      var newEl;
      el.setAttribute('teleport-controls', 'collisionEntities', '.teleportable');
      assert.equal(component.collisionEntities.length, 3);

      sceneEl.addEventListener('child-detached', () => {
        assert.equal(component.collisionEntities.length, 2);
        done();
      });
      sceneEl.removeChild(component.collisionEntities[0]);
    });
  });
});
