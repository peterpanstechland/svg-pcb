import { ClipperLib } from "./libs/clipper_unminified.js";

const overlap = (p0, p1) => 0.00000001 > Math.abs(p0.x - p1.x) + Math.abs(p0.y - p1.y);
const isClosed = shape => {
  if (shape.length === 0) return true;
  const start = shape[0][0];
  const end = shape.at(-1).at(-1);
  const closed = overlap(start, end);
  return closed;
}

export function offset(paths, delta, ops = {}) {
  /*
    {
      joinType
      endType
      miterLimit
      arcTolerance
    }
  */

  const endTypes = {
    openSquare: 0,
    openRound: 1,
    openButt: 2,
    closedLine: 3,
    closedPolygon: 4
  }

  const joinTypes = {
    square: 0,
    round: 1,
    miter: 2
  }

  let et = ops.endType;
  if (!(et in endTypes)) et = "closedPolygon";

  let jt = ops.joinType;
  if (!(jt in joinTypes)) jt = "round";

  const miterLimit = ops.miterLimit || 2;
  const arcTolerance = ops.arcTolerance || 0.1;

  const endType = endTypes[et];
  const joinType = joinTypes[jt];

  const toClipperFormat = pl => pl.map( 
    ({ x, y }) => ({ X:x, Y:y }) 
  )

  const fromClipperFormat = pl => pl.map( 
    ({ X, Y }) => ({ x:X, y:Y }) 
  )

  const subjectClosed = isClosed(paths);
  const clipPaths = paths.map(toClipperFormat);
  const co = new ClipperLib.ClipperOffset(miterLimit, arcTolerance);
  
  co.AddPaths(clipPaths, joinType, endType);
  const result = new ClipperLib.Paths();
  co.Execute(result, delta);

  const final = result.map(fromClipperFormat);

  while (paths.length > final.length) paths.pop();

  final.forEach((pl, i) =>  {
    paths[i] = pl;

    paths[i].push({
      x: pl[0].x,
      y: pl[0].y,
    })
    
  });

  return paths;
}