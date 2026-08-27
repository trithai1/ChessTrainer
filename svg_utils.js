const SVG_CONTAINER = document.getElementById("svg-container");

// Assumes Base 10. That viewbox width/height 10 units = 1 cell
const ARROW = [[1, -1.2], [3.5, -1.2], [3.1, -4], [8, 0], [3.1, 4], [3.5, 1.2], [1, 1.2]]; // Arrow pointing right. Length 1

export function removeAllSVG() {
    const SVGs = document.getElementsByClassName("svg");
    [...SVGs].forEach(element => element.remove());
}

export function removeDraggingSVG() {
    const draggingSVG = document.getElementsByClassName("svg dragging");
    [...draggingSVG].forEach(element => element.remove());
}

export function finalizeDraggingSVG() {
    const draggingSVG = document.getElementsByClassName("svg dragging");
    [...draggingSVG].forEach(element => {
        element.classList.remove("dragging");
        const className = [...element.classList].join('.');
        const matchingSVG = document.querySelectorAll(`.${className}`);
        if (matchingSVG.length > 1) {
            matchingSVG.forEach(element => element.remove());
        }
    });
}

export function draw(startRow, startCol, endRow, endCol, className=undefined, rows=8, cols=8) {
    if (Math.min(startRow, startCol, endRow, endCol) < 1 || Math.max(startRow, endRow) >= rows || Math.max(startCol, endCol) >= cols) {
        console.warn(`Invalid rows and columns to draw svg: ${startRow} ${startCol} ${endRow} ${endCol}`);
        return;
    }

    if (startRow === endRow && startCol === endCol) {
        drawCircle(startRow, startCol, className, rows, cols);
    } else {
        drawArrow(startRow, startCol, endRow, endCol, className, rows, cols);
    }
}

export function drawCircle(row, col, className=undefined, rows=8, cols=8) {
    const cx = col * 10 + 5;
    const cy = row * 10 + 5;

    const circleElement = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circleElement.setAttribute("r", "4.5");
    circleElement.setAttribute("cx", cx);
    circleElement.setAttribute("cy", cy);
    circleElement.setAttribute("stroke", "rgba(120, 194, 60, .70)");
    circleElement.setAttribute("fill", "none");
    circleElement.setAttribute("stroke-width", ".5");
    circleElement.setAttribute("class", `svg circle-${row}-${col} ${className}`);
    SVG_CONTAINER.appendChild(circleElement);
}

export function drawArrow(startRow, startCol, endRow, endCol, className=undefined, rows=8, cols=8) {
    const arrowElement = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    const length = (getDistance([startCol, startRow], [endCol, endRow]) - 1) * 10;
    const rad = Math.atan2(endRow - startRow, endCol - startCol);
    const cx = startCol * 10 + 5;
    const cy = startRow * 10 + 5;
    
    let arrow = ARROW.map(points => [...points]);
    for (let i = 1; i <= 5; i++) arrow[i][0] += length;
    for (let value of arrow) {
        let x = value[0];
        let y = value[1];
        const point = SVG_CONTAINER.createSVGPoint();
        const rotPoint = rotatePoint([x, y], rad);
        point.x = cx + rotPoint[0];
        point.y = cy + rotPoint[1];
        arrowElement.points.appendItem(point);
    }

    arrowElement.setAttribute("class", `svg arrow-${startRow}-${startCol}-${endRow}-${endCol} ${className}`);
    arrowElement.style.fill = "rgba(120, 194, 60, .70)";
    SVG_CONTAINER.appendChild(arrowElement);
}

function radToDeg(rad) { return rad * 180 / Math.PI; }
function degToRad(deg) { return deg * Math.PI / 180; }
function getAngleRad(point, origin=[0,0]) { return Math.atan2(point[1] - origin[1], point[0] - origin[0]); }

function getDistance(point1, point2) {
    const a = Math.abs(point1[0] - point2[0]);
    const b = Math.abs(point1[1] - point2[1]);
    return Math.sqrt(a**2 + b**2);
}

function getTriangleAngle(point1, point2, point3, returnDeg=undefined) {
    const angles = [null, null, null];
    const ab = getDistance(point1, point2);
    const bc = getDistance(point2, point3);
    const ca = getDistance(point3, point1);

    if (returnDeg === 1 || returnDeg === undefined) {
        angles[0] = Math.acos((ca**2 + ab**2 - bc**2) / (2*ca*ab));
    }
    if (returnDeg === 2 || returnDeg === undefined) {
        angles[1] = Math.acos((bc**2 + ab**2 - ca**2) / (2*bc*ab));
    }
    if (returnDeg === 3 || returnDeg === undefined) {
        angles[2] = Math.acos((bc**2 + ca**2 - ab**2) / (2*bc*ca));
    }
    return angles;
}

function rotatePoint(point, rad, origin=[0,0]) {
    const x = point[0] - origin[0];
    const y = point[1] - origin[1];
    const newX = x * Math.cos(rad) - y * Math.sin(rad) + origin[0];
    const newY = x * Math.sin(rad) + y * Math.cos(rad) + origin[1];
    return [newX, newY];
}