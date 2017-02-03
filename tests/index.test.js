/* global assert, setup, suite, test */
require('aframe');
require('../index.js');
var entityFactory = require('./helpers').entityFactory;

suite('teleport-controls component', function () {
  var component;
  var el;

  setup(function (done) {
    el = entityFactory();
    el.addEventListener('componentinitialized', function (evt) {
      if (evt.detail.name !== 'teleport-controls') { return; }
      component = el.components['teleport-controls'];
      done();
    });
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
    test('sets active for trackpad', function (done) {
      assert.notOk(component.active);
      el.emit('trackpaddown');
      setTimeout(() => {
        assert.ok(component.active);
        done();
      });
    });
  });

  suite('onButtonUp', function () {
  });
});
