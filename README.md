# aframe-teleport-component
Teleport component (Work in progress)

![Screenshot](https://github.com/fernandojsg/aframe-teleport-component/raw/master/teleport.png)

## Properties

| Property    | Description                     | Default Value    |
| --------    | -----------                     | -------------    |
| button       | Button used to launch the teleport         | trackpad   |
| collisionEntity | Selector of the mesh used to check the collisions. If no value provided a plane Y=0 is used |  |
| hitEntity | Entity used to show at the hitting position. If no value provided a cylinder will be used as default. |           |
| hitCylinderColor | Color used for the default `hitEntity` primitives | #99ff99          |
| hitCylinderRadius | Radius used for the default `hitEntity` primitives | 0.25          |
| curveHitColor | Color used for the curve when hit the mesh | #99ff99          |
| curveMissColor | Color used for the curve when it doesn't hit anything | #ff0000          |
| curveNumberPoints | Number of points used in the curve | 30          |
| curveLineWidth | Line width of the curve | 0.025          |
| curveShootingSpeed | Curve shooting speed, as bigger value, farther distance. | 5          |
| landingNormal | Normal vector to detect collisions with the `collisionEntity` | (0, 1, 0)          |
| landingMaxAngle | Angle threshold (in degrees) used together with `landingNormal` to detect if the mesh is so steep to jump to it. | 45          |

### Usage

#### Browser Installation

Install and use by directly including the [browser files](dist):

```html
<head>
  <title>My A-Frame Scene</title>
  <script src="https://aframe.io/releases/0.3.2/aframe.min.js"></script>
  <script src="https://rawgit.com/fernandojsg/aframe-teleport-component/master/dist/aframe-teleport-component.min.js"></script>
</head>

<body>
  <a-scene>
    <a-entity teleport vive-controls="hand: left"></a-entity>
  </a-scene>
</body>
```

#### NPM Installation

Install via NPM:

```bash
npm install aframe-teleport-component
```

Then register and use.

```js
require('aframe-teleport-component');
```
