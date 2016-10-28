var RayCurve = function (numPoints, width, up) {
  this.geometry = new THREE.BufferGeometry();
  this.vertices = new Float32Array(numPoints * 3 * 2);
  this.uvs = new Float32Array(numPoints * 2 * 2);
  this.width = width;

  this.geometry.addAttribute('position', new THREE.BufferAttribute(this.vertices, 3).setDynamic(true));

  this.material = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    color: 0xff0000
  });

  this.mesh = new THREE.Mesh(this.geometry, this.material);
  this.mesh.drawMode = THREE.TriangleStripDrawMode;

  this.mesh.frustumCulled = false;
  this.mesh.vertices = this.vertices;

  this.points = [];
  for (var i = 0; i < numPoints; i++) {
    this.points.push(new THREE.Vector3());
  }
  this.numPoints = numPoints;
  this.usedPoints = 0;
};

RayCurve.prototype = {
  setPoint: function (i, point) {
    this.points[i] = point.clone();
  },
  update: function () {
    var direction = new THREE.Vector3();
    var posA = new THREE.Vector3();
    var posB = new THREE.Vector3();

    this.idx = 0;
    direction = this.points[0].clone().sub(this.points[1]).normalize();
    var UP = new THREE.Vector3(0, 1, 0);
    direction.cross(UP).normalize();

    for (var i = 0; i < this.numPoints; i++) {
      posA.copy(this.points[i]).add(direction.clone().multiplyScalar(this.width / 2));
      posB.copy(this.points[i]).add(direction.clone().multiplyScalar(-this.width / 2));

      this.vertices[this.idx++] = posA.x;
      this.vertices[this.idx++] = posA.y;
      this.vertices[this.idx++] = posA.z;

      this.vertices[this.idx++] = posB.x;
      this.vertices[this.idx++] = posB.y;
      this.vertices[this.idx++] = posB.z;
    }

    this.geometry.attributes.position.needsUpdate = true;
  }
};

module.exports = RayCurve;
