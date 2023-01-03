# TODO

- [ ] remove
	- storedPCB
	- addTranslateHandle
	- xmlline from svg import
- [ ] path
	- handle types
		- pt
		- fillet
		- chamfer
		- bezier (2 handles)
		- turnForward?
		- vec?
	- should be able to do this for any pt
- [ ] preview path
- [?] change coordinate system of components
- [x] dropped svgs turn into components
- [ ] make README nice and informative
- [ ] better documentation
- [ ] render components directly from board object
	- don't squash into layers
	- this allows people to click components and pads
- [ ] gui for layer menu
	- color picker
- [ ] better snap to grid control
- [ ] clean up/decide what `path` returns and what `addShape` and `addWire` take
- [ ] adaptive grid option
- [ ] render paths (not just fills/shapes)
	- add path to board
- [ ] ability to create wires from gui
- [ ] more graphical handles
	- rotating (could do on placement)
	- deleting components (?)
- [ ] infer constraints when drawing
- [ ] make geogram use `[x, y]` vs `{ x, y }` internally
- [ ] create gram class for fluid programming
- [ ] gerber export
- [ ] handle infinite loops
	- use timeout to check if first run is too slow
- [ ] net lists
- [ ] autorouting
- [ ] copper fills
- [ ] make it work in firefox
- [x] leave point on mouse up, if dragged don't leave point
- [ ] better import menu
	- import from component from json
	- import component libraries
- [ ] select multiple points at once
- [ ] don't show all pts on screen at once
- [ ] better path gui
	- [ ] show where path would be when editting
	- [ ] don't show points on path unless path selected
- [ ] select path from gui
- [ ] clear selection box better
- [ ] when dragging screen and triggering out drag continues on re-entry
- [ ] indent new points properly
- [ ] kicad components sometimes drop text in program and aren't converted
- [ ] add visual cue when uploading something
	- [ ] js
	- [ ] json component
	- [ ] svg ?
	- [ ] kicad_comp
- [ ] add svg uploading
- [ ] export/import
	- [ ] kicad
	- [ ] eagle
	- [ ] gerber
- [ ] clean up code
	- remove translate handle code (`pt`s superseded)