/* global THREE */
var RayCurve = function (numPoints, width) {
  this.geometry = new THREE.BufferGeometry();
  this.vertices = new Float32Array(numPoints * 3 * 2);
  this.uvs = new Float32Array(numPoints * 2 * 2);
  this.width = width;

  //addAttribute deprecated in favor of setAttribute and setDynamic deprecated in favor of setUsage
  this.geometry.setAttribute('position', new THREE.BufferAttribute(this.vertices, 3).setUsage(true));

  this.material = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    color: 0xff0000
  });

  this.mesh = new THREE.Mesh(this.geometry, this.material);


/* THIS COMMENTED OUT BECAUSE
THREE.Mesh: .drawMode has been removed. The renderer now always assumes THREE.TrianglesDrawMode. Transform your geometry via BufferGeometryUtils.toTrianglesDrawMode() if necessary.
*/
  //this.mesh.drawMode = THREE.TriangleStripDrawMode;

  this.mesh.frustumCulled = false;
  this.mesh.vertices = this.vertices;

  this.direction = new THREE.Vector3();
  this.numPoints = numPoints;
};

RayCurve.prototype = {
  setDirection: function (direction) {
    var UP = new THREE.Vector3(0, 1, 0);
    this.direction
      .copy(direction)
      .cross(UP)
      .normalize()
      .multiplyScalar(this.width / 2);
  },

  setWidth: function (width) {
    this.width = width;
  },

  setPoint: (function () {
    var posA = new THREE.Vector3();
    var posB = new THREE.Vector3();

    return function (i, point) {
      posA.copy(point).add(this.direction);
      posB.copy(point).sub(this.direction);

      var idx = 2 * 3 * i;
      this.vertices[idx++] = posA.x;
      this.vertices[idx++] = posA.y;
      this.vertices[idx++] = posA.z;

      this.vertices[idx++] = posB.x;
      this.vertices[idx++] = posB.y;
      this.vertices[idx++] = posB.z;

      this.geometry.attributes.position.needsUpdate = true;
    };
  })()
};

module.exports = RayCurve;
