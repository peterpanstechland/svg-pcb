import { view } from "./view.js";
import { render } from "lit-html";

import { addEvents } from "./events.js";

import { PCB as real_PCB } from "./pcb.js";
import { via } from "./pcb_helpers.js";
import { kicadToObj } from "./ki_cad_parser.js"
import { getFootprints } from "./getFootprints.js";
import { getWires } from "./getWires.js";
import { getFileSection } from "./getFileSection.js"
import * as geo from "/geogram/index.js";


const STATE = {
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
	panZoomParams: undefined,
	previewFootprint: null,
	paths: [],
}

class PCB extends real_PCB {
	constructor() {
		super();
		STATE.storedPCB = this;
	}
}

// {
//   board: board,
//   layerColors: { // have default colors for default layers
//     "F.Cu": "red",
//     "Vias": "rbg(32, 32, 32)",
//   },
//   limits: {
//     x: [0, 1],
//     y: [0, 1]
//   },
//   mm_per_unit: 25.4
// }

const default_renderPCB_params = {
	pcb: null,
	layerColors: { "F.Cu": "#ff8c00cc" },
	limits: {
	    x: [0, 1],
	    y: [0, 1]
	},
	mm_per_unit: 25.4,
}

function renderPCB({ pcb, layerColors, limits, mm_per_unit }) {
	if (pcb === undefined) console.log("renderPCB must include pcb param");

	if (layerColors === undefined) layerColors = default_renderPCB_params.layerColors;
	if (limits === undefined) limits = default_renderPCB_params.limits;
	if (mm_per_unit === undefined) mm_per_unit = default_renderPCB_params.mm_per_unit;

	const shapes = [];
	for (const layer in layerColors) {
		shapes.push({
			data: pcb.getLayer(layer), // could be pathData or text
			color: layerColors[layer],
			groupId: layer
		});
	}

	STATE.shapes = shapes; // TODO ??? what should the shape format be { d: path data string, color: hex or valid svg color, classes: []}
	STATE.limits = limits;
	STATE.mm_per_unit = mm_per_unit;

	// renders the outline not the interior
	STATE.paths = pcb.getLayer("paths") || [];

	dispatch("RENDER");
}

const default_renderShapes_params = {
	shapes: [],
	limits: {
	    x: [0, 1],
	    y: [0, 1]
	},
	mm_per_unit: 25.4,
}

function renderShapes({ shapes, limits, mm_per_unit }) {
	if (shapes === undefined) shapes = default_renderShapes_params.shapes;
	if (limits === undefined) limits = default_renderShapes_params.limits;
	if (mm_per_unit === undefined) mm_per_unit = default_renderShapes_params.mm_per_unit;

	STATE.shapes = shapes;
	STATE.limits = limits;
	STATE.mm_per_unit = mm_per_unit;

	dispatch("RENDER");
}

const included = {
	kicadToObj,
	geo,
	PCB,
	via,
	renderPCB,
	renderShapes,
	document: null,
	window: null,
	localStorage: null,
	Function: null,
	eval: null,
	// "import": null,
}

async function urlToCode(file_url, state) {
	const file = await fetch(file_url,  {mode: 'cors'});
	const txt = await file.text();

    state.codemirror.view.dispatch({
	  changes: {from: 0, insert: txt}
	});

    // fold imports
	const anotherComp = l => l.includes("return kicadToObj(");

	const doc = state.codemirror.view.state.doc;
	const lines = doc.toString().split("\n");
	let i = 0;
	let count = 0;
	while (true) {
		const line = lines[i];
		if (!line) break;
		count += line.length;
		if (i > lines.length) break;
		if (lines[i] === "`)})()" && !anotherComp(lines[i+1])) break;
		i++;
	};

	state.codemirror.foldRange(0, count+i);

    dispatch("RUN");
    document.querySelector(".center-button").click();
}

const r = () => {
	render(view(STATE), document.getElementById("root"));
	requestAnimationFrame(r);
}

const ACTIONS = {
	INIT(args, state) {
		// r();

		dispatch("RENDER");
		state.codemirror = document.querySelector("#code-editor");
		addEvents(state);

		const url = new URL(window.location.href);

	    const search = window.location.search;
	    const code = new URLSearchParams(search).get("code");
	    const file = new URLSearchParams(search).get("file");
	    const handlesOff = new URLSearchParams(search).get("bezier") === "false";
	    const gridOff = new URLSearchParams(search).get("grid") === "false";

	    if (handlesOff) state.viewHandles = false;
	    if (gridOff) state.grid = false;

	    if (code) {

	    } else if (file) {
          let file_url = file;
          if (!file.startsWith("http")) file_url = `examples/${file}`;

          urlToCode(file_url, state);
	    } else { // should check before running this
	    	const saved = window.localStorage.getItem("svg-pcb")
			    state.codemirror.view.dispatch({
				  changes: {from: 0, insert: saved ?? ""}
				});

				dispatch("RUN");
				document.querySelector(".center-button").click();
	    }

	    dispatch("RENDER");
	},
	RUN({ dragging = false } = {}, state) {
		const string = state.codemirror.view.state.doc.toString();

		if (!dragging) {
			let footprints = [];
			try {
				footprints = getFootprints(string);
				// TODO: should get wires here as well
			} catch (err) {
				console.error(err);
			}

			state.footprints = footprints;
		}



		// need to sanitize text

		const BLACK_LISTED_WORDS = []; // import, document, window, localStorage
		BLACK_LISTED_WORDS.forEach(word => {
			if (string.includes(word))
				throw `"${word}" is not permitted due to security concerns.`;
		});

		const f = new Function(...Object.keys(included), string)
		f(...Object.values(included));

	},
	NEW_FILE(args, state) {
		const text = `/* -- DECLARE_COMPONENTS -- */
const Molex_serial = {"Rx":{"shape":"M -0.015499999999999998 0.026500000000000003L 0.015500000000000002 0.026500000000000003L 0.015500000000000005 -0.026499999999999996L -0.015499999999999991 -0.026500000000000003L -0.015500000000000005 0.026499999999999996","pos":[-0.075,0.064],"layers":["F.Cu"],"index":1},"Tx":{"shape":"M -0.015499999999999998 0.026500000000000003L 0.015500000000000002 0.026500000000000003L 0.015500000000000005 -0.026499999999999996L -0.015499999999999991 -0.026500000000000003L -0.015500000000000005 0.026499999999999996","pos":[-0.025,0.064],"layers":["F.Cu"],"index":2},"DTR":{"shape":"M -0.015499999999999998 0.026500000000000003L 0.015500000000000002 0.026500000000000003L 0.015500000000000005 -0.026499999999999996L -0.015499999999999991 -0.026500000000000003L -0.015500000000000005 0.026499999999999996","pos":[0.025,0.064],"layers":["F.Cu"],"index":3},"GND":{"shape":"M -0.015499999999999998 0.026500000000000003L 0.015500000000000002 0.026500000000000003L 0.015500000000000005 -0.026499999999999996L -0.015499999999999991 -0.026500000000000003L -0.015500000000000005 0.026499999999999996","pos":[0.075,0.064],"layers":["F.Cu"],"index":4},"NC1":{"shape":"M -0.055 0.065L 0.055 0.065L 0.055000000000000014 -0.065L -0.055 -0.065L -0.055000000000000014 0.065","pos":[-0.16,-0.065],"layers":["F.Cu"],"index":0},"NC2":{"shape":"M -0.055 0.065L 0.055 0.065L 0.055000000000000014 -0.065L -0.055 -0.065L -0.055000000000000014 0.065","pos":[0.16,-0.065],"layers":["F.Cu"],"index":0}}
const DRV8428_HTSSOP = {"VM":{"shape":"M -0.029 0.0053000000000000035L 0.029 0.0053000000000000035L 0.029 -0.0052999999999999966L -0.029 -0.0053000000000000035L -0.029 0.0052999999999999966 M -0.029 -0.0053L -0.028815032667476745 -0.005296771383201207L -0.028630290689156138 -0.005287089466377069L -0.028445999144681437 -0.005270966045451849L -0.028262382564911655 -0.005248420764330322L -0.02807966465836527 -0.0052194810909647026L -0.027898068038665878 -0.00518418228388917L -0.027717813953321763 -0.005142567349262782L -0.027539122014169908 -0.00509468698847309L -0.02736220992981278 -0.005040599536364314L -0.027187293240373958 -0.004980370890165314L -0.02701458505489567 -0.004914074429203974L -0.02684429579169826 -0.004841790925505785L -0.02667663292201789 -0.004763608445385585L -0.02651180071723478 -0.0046796222421523126L -0.026350000000000002 -0.004589934640057525L -0.026191427899564017 -0.004494654909629058L -0.026036277611605044 -0.00439389913454172L -0.025884738162849894 -0.004287790070187222L -0.025736994180774013 -0.004176456994115627L -0.025593225668661342 -0.004060035548530584L -0.025453607786298054 -0.00393866757503019L -0.025318310636567316 -0.0038125009417948512L -0.02518749905820515 -0.003681689363432686L -0.02506133242496981 -0.003546392213701949L -0.02493996445146942 -0.0034067743313386583L -0.024823543005884376 -0.003263005819225989L -0.02471220992981278 -0.0031152618371501077L -0.02460610086545828 -0.002963722388394958L -0.024505345090370945 -0.002808572100435986L -0.024410065359942477 -0.002650000000000001L -0.024320377757847688 -0.002488199282765222L -0.024236391554614416 -0.002323367077982111L -0.024158209074494216 -0.0021557042083017413L -0.02408592557079603 -0.001985414945104333L -0.024019629109834687 -0.0018127067596260447L -0.023959400463635688 -0.0016377900701872211L -0.023905313011526912 -0.0014608779858300957L -0.02385743265073722 -0.0012821860466782397L -0.023815817716110833 -0.0011019319613341256L -0.0237805189090353 -0.0009203353416347322L -0.02375157923566968 -0.0007376174350883485L -0.023729033954548152 -0.0005540008553185632L -0.023712910533622934 -0.0003697093108438647L -0.023703228616798792 -0.00018496733252325575L -0.023700000000000002 -8.673617379884035e-19L -0.023703228616798792 0.00018496733252325401L -0.023712910533622934 0.00036970931084386385L -0.023729033954548152 0.0005540008553185632L -0.02375157923566968 0.0007376174350883467L -0.0237805189090353 0.0009203353416347313L -0.023815817716110833 0.001101931961334123L -0.02385743265073722 0.0012821860466782405L -0.023905313011526912 0.0014608779858300957L -0.023959400463635688 0.0016377900701872216L -0.024019629109834687 0.001812706759626045L -0.02408592557079603 0.0019854149451043347L -0.024158209074494216 0.002155704208301739L -0.024236391554614416 0.0023233670779821127L -0.024320377757847688 0.00248819928276522L -0.024410065359942477 0.0026499999999999987L -0.024505345090370945 0.0028085721004359855L -0.02460610086545828 0.002963722388394958L -0.02471220992981278 0.0031152618371501064L -0.024823543005884373 0.0032630058192259894L -0.02493996445146942 0.0034067743313386566L -0.02506133242496981 0.0035463922137019483L -0.025187499058205148 0.0036816893634326843L -0.025318310636567316 0.0038125009417948512L -0.02545360778629805 0.003938667575030189L -0.025593225668661342 0.004060035548530583L -0.025736994180774013 0.004176456994115624L -0.025884738162849894 0.004287790070187221L -0.026036277611605044 0.00439389913454172L -0.026191427899564017 0.004494654909629058L -0.026350000000000002 0.004589934640057526L -0.026511800717234777 0.004679622242152314L -0.02667663292201789 0.004763608445385584L -0.02684429579169826 0.004841790925505784L -0.027014585054895665 0.004914074429203973L -0.027187293240373958 0.0049803708901653134L -0.02736220992981278 0.005040599536364315L -0.027539122014169904 0.005094686988473088L -0.027717813953321763 0.00514256734926278L -0.027898068038665878 0.005184182283889169L -0.02807966465836527 0.005219481090964702L -0.028262382564911655 0.0052484207643303206L -0.028445999144681437 0.005270966045451848L -0.028630290689156138 0.005287089466377068L -0.02881503266747675 0.005296771383201208L -0.029 0.0053L -0.029184967332523255 0.005296771383201208L -0.029369709310843862 0.005287089466377068L -0.029554000855318563 0.005270966045451848L -0.029737617435088348 0.0052484207643303206L -0.029920335341634734 0.005219481090964702L -0.030101931961334125 0.005184182283889171L -0.03028218604667824 0.005142567349262782L -0.030460877985830095 0.005094686988473092L -0.030637790070187226 0.005040599536364313L -0.030812706759626045 0.0049803708901653134L -0.030985414945104334 0.004914074429203973L -0.03115570420830174 0.004841790925505784L -0.03132336707798211 0.004763608445385584L -0.03148819928276522 0.004679622242152314L -0.031650000000000005 0.004589934640057526L -0.031808572100435986 0.004494654909629058L -0.03196372238839496 0.004393899134541722L -0.032115261837150105 0.004287790070187223L -0.03226300581922599 0.004176456994115628L -0.03240677433133866 0.004060035548530583L -0.03254639221370195 0.003938667575030189L -0.03268168936343269 0.0038125009417948512L -0.03281250094179485 0.0036816893634326877L -0.03293866757503019 0.00354639221370195L -0.033060035548530584 0.00340677433133866L -0.03317645699411563 0.0032630058192259876L -0.03328779007018722 0.003115261837150108L -0.03339389913454172 0.0029637223883949614L -0.03349465490962906 0.0028085721004359873L -0.03358993464005752 0.002650000000000002L -0.03367962224215232 0.0024881992827652227L -0.03376360844538558 0.0023233670779821127L -0.03384179092550579 0.002155704208301741L -0.03391407442920397 0.0019854149451043347L -0.03398037089016531 0.0018127067596260486L -0.03404059953636431 0.0016377900701872216L -0.034094686988473094 0.001460877985830093L -0.034142567349262784 0.0012821860466782405L -0.03418418228388917 0.0011019319613341265L -0.034219481090964704 0.0009203353416347313L -0.03424842076433032 0.0007376174350883441L -0.03427096604545185 0.0005540008553185632L -0.03428708946637707 0.0003697093108438656L -0.03429677138320121 0.00018496733252325922L -0.034300000000000004 8.673617379884035e-19L -0.03429677138320121 -0.00018496733252325748L -0.03428708946637707 -0.000369709310843863L -0.03427096604545185 -0.0005540008553185614L -0.03424842076433032 -0.0007376174350883467L -0.034219481090964704 -0.0009203353416347287L -0.03418418228388917 -0.0011019319613341213L -0.034142567349262784 -0.001282186046678238L -0.034094686988473094 -0.0014608779858300974L -0.03404059953636432 -0.0016377900701872198L -0.03398037089016532 -0.0018127067596260408L -0.03391407442920397 -0.001985414945104333L -0.03384179092550579 -0.002155704208301744L -0.03376360844538558 -0.002323367077982111L -0.03367962224215232 -0.002488199282765219L -0.03358993464005752 -0.002650000000000001L -0.03349465490962906 -0.002808572100435985L -0.03339389913454172 -0.0029637223883949553L -0.03328779007018722 -0.003115261837150107L -0.03317645699411563 -0.00326300581922599L -0.033060035548530584 -0.003406774331338658L -0.032938667575030195 -0.0035463922137019465L -0.03281250094179486 -0.0036816893634326825L -0.03268168936343269 -0.0038125009417948495L -0.03254639221370195 -0.00393866757503019L -0.032406774331338664 -0.004060035548530582L -0.03226300581922599 -0.004176456994115624L -0.03211526183715011 -0.004287790070187221L -0.03196372238839496 -0.004393899134541719L -0.03180857210043599 -0.004494654909629055L -0.031650000000000005 -0.004589934640057523L -0.03148819928276522 -0.0046796222421523126L -0.03132336707798211 -0.004763608445385586L -0.031155704208301743 -0.004841790925505785L -0.030985414945104338 -0.004914074429203973L -0.030812706759626045 -0.004980370890165314L -0.030637790070187222 -0.005040599536364314L -0.0304608779858301 -0.005094686988473089L -0.03028218604667824 -0.005142567349262781L -0.03010193196133413 -0.005184182283889169L -0.029920335341634737 -0.005219481090964702L -0.02973761743508835 -0.005248420764330322L -0.029554000855318563 -0.005270966045451849L -0.029369709310843862 -0.005287089466377069L -0.029184967332523255 -0.005296771383201207L -0.029 -0.0053","pos":[-0.12,0.089565],"layers":["F.Cu"],"index":1},"PGND":{"shape":"M -0.029 0.0053000000000000035L 0.029 0.0053000000000000035L 0.029 -0.0052999999999999966L -0.029 -0.0053000000000000035L -0.029 0.0052999999999999966","pos":[-0.12,0.063975],"layers":["F.Cu"],"index":2},"AOUT1":{"shape":"M -0.029 0.0053000000000000035L 0.029 0.0053000000000000035L 0.029 -0.0052999999999999966L -0.029 -0.0053000000000000035L -0.029 0.0052999999999999966","pos":[-0.12,0.038385],"layers":["F.Cu"],"index":3},"AOUT2":{"shape":"M -0.029 0.0053000000000000035L 0.029 0.0053000000000000035L 0.029 -0.0052999999999999966L -0.029 -0.0053000000000000035L -0.029 0.0052999999999999966","pos":[-0.12,0.012795],"layers":["F.Cu"],"index":4},"BOUT2":{"shape":"M -0.029 0.0053000000000000035L 0.029 0.0053000000000000035L 0.029 -0.0052999999999999966L -0.029 -0.0053000000000000035L -0.029 0.0052999999999999966","pos":[-0.12,-0.012795],"layers":["F.Cu"],"index":5},"BOUT1":{"shape":"M -0.029 0.0053000000000000035L 0.029 0.0053000000000000035L 0.029 -0.0052999999999999966L -0.029 -0.0053000000000000035L -0.029 0.0052999999999999966","pos":[-0.12,-0.038385],"layers":["F.Cu"],"index":6},"GND1":{"shape":"M -0.029 0.0053000000000000035L 0.029 0.0053000000000000035L 0.029 -0.0052999999999999966L -0.029 -0.0053000000000000035L -0.029 0.0052999999999999966","pos":[-0.12,-0.063975],"layers":["F.Cu"],"index":7},"GND2":{"shape":"M -0.05999999999999999 0.09000000000000001L 0.060000000000000005 0.09000000000000001L 0.06000000000000002 -0.08999999999999998L -0.05999999999999996 -0.09000000000000001L -0.06000000000000002 0.08999999999999998","pos":[0,0],"layers":["F.Cu"],"index":17},"DVDD":{"shape":"M -0.029 0.0053000000000000035L 0.029 0.0053000000000000035L 0.029 -0.0052999999999999966L -0.029 -0.0053000000000000035L -0.029 0.0052999999999999966","pos":[-0.12,-0.089565],"layers":["F.Cu"],"index":8},"VREF":{"shape":"M -0.029 0.0053000000000000035L 0.029 0.0053000000000000035L 0.029 -0.0052999999999999966L -0.029 -0.0053000000000000035L -0.029 0.0052999999999999966","pos":[0.12,-0.089565],"layers":["F.Cu"],"index":9},"M0":{"shape":"M -0.029 0.0053000000000000035L 0.029 0.0053000000000000035L 0.029 -0.0052999999999999966L -0.029 -0.0053000000000000035L -0.029 0.0052999999999999966","pos":[0.12,-0.063975],"layers":["F.Cu"],"index":10},"DECAY":{"shape":"M -0.029 0.0053000000000000035L 0.029 0.0053000000000000035L 0.029 -0.0052999999999999966L -0.029 -0.0053000000000000035L -0.029 0.0052999999999999966","pos":[0.12,-0.038385],"layers":["F.Cu"],"index":11},"M1":{"shape":"M -0.029 0.0053000000000000035L 0.029 0.0053000000000000035L 0.029 -0.0052999999999999966L -0.029 -0.0053000000000000035L -0.029 0.0052999999999999966","pos":[0.12,-0.012795],"layers":["F.Cu"],"index":12},"STEP":{"shape":"M -0.029 0.0053000000000000035L 0.029 0.0053000000000000035L 0.029 -0.0052999999999999966L -0.029 -0.0053000000000000035L -0.029 0.0052999999999999966","pos":[0.12,0.012795],"layers":["F.Cu"],"index":13},"DIR":{"shape":"M -0.029 0.0053000000000000035L 0.029 0.0053000000000000035L 0.029 -0.0052999999999999966L -0.029 -0.0053000000000000035L -0.029 0.0052999999999999966","pos":[0.12,0.038385],"layers":["F.Cu"],"index":14},"EN":{"shape":"M -0.029 0.0053000000000000035L 0.029 0.0053000000000000035L 0.029 -0.0052999999999999966L -0.029 -0.0053000000000000035L -0.029 0.0052999999999999966","pos":[0.12,0.063975],"layers":["F.Cu"],"index":15},"SLEEP":{"shape":"M -0.029 0.0053000000000000035L 0.029 0.0053000000000000035L 0.029 -0.0052999999999999966L -0.029 -0.0053000000000000035L -0.029 0.0052999999999999966","pos":[0.12,0.089565],"layers":["F.Cu"],"index":16}};

// constants
const width = 1;
const height = 1;

/* -- DECLARE_PCB -- */
let board = new PCB();

let interior = geo.rectangle(width, height)

board.addShape("interior", interior);

/* -- ADD_COMPONENTS -- */

/* -- ADD_WIRES -- */

/* -- RENDER_PCB -- */
renderPCB({
  pcb: board,
  layerColors: {
    "interior": "#002d00ff",
    "B.Cu": "#ff4c007f",
    "F.Cu": "#ff8c00cc",
    "drill": "#ff3300e5",
    "padLabels": "#ffff99e5",
    "componentLabels": "#00e5e5e5",
  },
  limits: {
    x: [-width/2, width/2],
    y: [-height/2, height/2]
  },
  mm_per_unit: 25.4
});
`
	  dispatch("UPLOAD_JS", { text });
	},
	UPLOAD_COMP({ text, name }, state) {
		text = text.replaceAll("$", "");
		text = JSON.stringify(kicadToObj(text));
		text = `const ${"temp_name"} = ${text}\n`

		const string = state.codemirror.view.state.doc.toString();
		const startIndex = getFileSection("DECLARE_COMPONENTS", string) ?? 0;
		state.codemirror.view.dispatch({
		  changes: {from: startIndex, insert: text}
		});

		state.codemirror.foldRange(0, text.length);
		dispatch("RENDER");
	},
	UPLOAD_JS({ text }, state) {
		const end = state.codemirror.view.state.doc.toString().length;
		state.codemirror.view.dispatch({
		  changes: {from: 0, to: end, insert: text}
		});

		dispatch("RUN");
		document.querySelector(".center-button").click()
	},
	ADD_IMPORT({ text, name }, state) {
		const alreadyImported = state.footprints.map(x => x[0]);
		if (alreadyImported.includes(name)) return;

		const string = state.codemirror.view.state.doc.toString();
		const startIndex = getFileSection("DECLARE_COMPONENTS", string) ?? 0;

		text = `const ${name} = ${text}\n`
		state.codemirror.view.dispatch({
		  changes: {from: startIndex, insert: text}
		});

		dispatch("RUN");
	},
	TRANSLATE({ x, y, index }, state) {
		state.transformUpdate(x, y);
		dispatch("RUN", { dragging: true });
	},
	RENDER() {
		render(view(STATE), document.getElementById("root"));
	}
}

export function dispatch(action, args = {}) {
	const trigger = ACTIONS[action];
	if (trigger) {
		// console.time(action);
		const result = trigger(args, STATE);
		// console.timeEnd(action);
		return result;
	}
	else console.log("Action not recongnized:", action);
}


