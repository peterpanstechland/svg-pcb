export const global_state = {
  codemirror: undefined,
  storedPCB: undefined,
  transforming: false,
  transformUpdate: () => {},
  selectBox: {},
  footprints: [],
  wires: [],
  shapes: [],
  limits: {
    x: [0, 1],
    y: [0, 1]
  },
  mm_per_unit: 25.4,
  grid: true,
  gridSize: 0.05,
  viewHandles: true,
  selectedPath: null,
  panZoomParams: undefined,
  previewFootprint: null,
  paths: [],
  pts: [], 
  name: "",
  error: ""
  // how do you know what point values are and how they map to concrete syntax tree
}

window.getState = () => global_state;