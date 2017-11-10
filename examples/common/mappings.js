var mappings = {
  mappings: {
    default: {
      common: {
        trackpaddown: 'teleportstart',
        trackpadup: 'teleportend'
      },
      'oculus-touch-controls': {
        thumbstickdown: 'teleportstart',
        thumbstickup: 'teleportend'
      },
      keyboard: {
        't_down': 'teleportstart',
        't_up': 'teleportend'
      }
    }
  }
};

AFRAME.registerInputMappings(mappings);
