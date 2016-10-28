# aframe-teleport-component
Teleport component (Work in progress)

![Screenshot](https://github.com/fernandojsg/aframe-teleport-component/raw/master/teleport.png)

## Properties

| Property    | Description                     | Default Value    |
| --------    | -----------                     | -------------    |
| button       | Button used to launch the teleport         | trackpad   |
| collisionMesh | Selector of the mesh used to check the collisions. If no value provided a plane Y=0 is used |  |
| hitEntity | Entity used to show at the hitting position. If no value provided a cylinder will be used as default. |           |
| defaultEntityColor | Color used for the default `hitEntity` primitives | #99ff99          |
| defaultEntityRadius | Radius used for the default `hitEntity` primitives | 0.25          |
| hitColor | Color used for the curve when hit the mesh | #99ff99          |
| missColor | Color used for the curve when it doesn't hit anything | #ff0000          |
| numberPoints | Number of points used in the curve | 30          |
| lineWidth | Line width of the curve | 0.025          |
| normal | Normal vector to detect collisions with the `collisionMesh` | (0, 1, 0)          |
| angleThreshold | Angle threshold (in degrees) used together with `normal` to detect if the mesh is so steep to jump to it. | 45          |
| shootingSpeed | Curve shooting speed, as bigger value, farther distance. | 5          |

### Usage

#### Browser Installation

Install and use by directly including the [browser files](dist):

```html
<head>
  <title>My A-Frame Scene</title>
  <script src="https://aframe.io/releases/0.3.2/aframe.min.js"></script>
  <script src="https://rawgit.com/fernandojsg/aframe-teleport-component/tree/master/dist/aframe-etleport-component.min.js"></script>
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
