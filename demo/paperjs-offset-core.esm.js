/**
 * Offset the start/terminal segment of a bezier curve
 * @param segment segment to offset
 * @param curve curve to offset
 * @param handleNormal the normal of the the line formed of two handles
 * @param offset offset value
 */
function offsetSegment(segment, curve, handleNormal, offset, paperScope) {
    const isFirst = segment.curve === curve;
    // get offset vector
    const offsetVector = (curve.getNormalAtTime(isFirst ? 0 : 1)).multiply(offset);
    // get offset point
    const point = segment.point.add(offsetVector);
    const newSegment = new paperScope.Segment(point);
    // handleOut for start segment & handleIn for terminal segment
    const handle = (isFirst ? 'handleOut' : 'handleIn');
    newSegment[handle] = segment[handle].add(handleNormal.subtract(offsetVector).divide(2));
    return newSegment;
}
/**
 * Adaptive offset a curve by repeatly apply the approximation proposed by Tiller and Hanson.
 * @param curve curve to offset
 * @param offset offset value
 */
function adaptiveOffsetCurve(curve, offset, paperScope) {
    const hNormal = (new paperScope.Curve(curve.segment1.handleOut.add(curve.segment1.point), new paperScope.Point(0, 0), new paperScope.Point(0, 0), curve.segment2.handleIn.add(curve.segment2.point))).getNormalAtTime(0.5).multiply(offset);
    const segment1 = offsetSegment(curve.segment1, curve, hNormal, offset, paperScope);
    const segment2 = offsetSegment(curve.segment2, curve, hNormal, offset, paperScope);
    // divide && re-offset
    const offsetCurve = new paperScope.Curve(segment1, segment2);
    // if the offset curve is not self intersected, divide it
    if (offsetCurve.getIntersections(offsetCurve).length === 0) {
        const threshold = Math.min(Math.abs(offset) / 10, 1);
        const midOffset = offsetCurve.getPointAtTime(0.5).getDistance(curve.getPointAtTime(0.5));
        if (Math.abs(midOffset - Math.abs(offset)) > threshold) {
            const subCurve = curve.divideAtTime(0.5);
            if (subCurve != null) {
                return [...adaptiveOffsetCurve(curve, offset, paperScope), ...adaptiveOffsetCurve(subCurve, offset, paperScope)];
            }
        }
    }
    return [segment1, segment2];
}
/**
 * Create a round join segment between two adjacent segments.
 */
function makeRoundJoin(segment1, segment2, originPoint, radius, paperScope) {
    const through = segment1.point.subtract(originPoint).add(segment2.point.subtract(originPoint))
        .normalize(Math.abs(radius)).add(originPoint);
    const arc = new paperScope.Path.Arc({ from: segment1.point, to: segment2.point, through, insert: false });
    segment1.handleOut = arc.firstSegment.handleOut;
    segment2.handleIn = arc.lastSegment.handleIn;
    return arc.segments.length === 3 ? arc.segments[1] : null;
}
function det(p1, p2) {
    return p1.x * p2.y - p1.y * p2.x;
}
/**
 * Get the intersection point of point based lines
 */
function getPointLineIntersections(p1, p2, p3, p4, paperScope) {
    const l1 = p1.subtract(p2);
    const l2 = p3.subtract(p4);
    const dl1 = det(p1, p2);
    const dl2 = det(p3, p4);
    return new paperScope.Point(dl1 * l2.x - l1.x * dl2, dl1 * l2.y - l1.y * dl2).divide(det(l1, l2));
}
/**
 * Connect two adjacent bezier curve, each curve is represented by two segments,
 * create different types of joins or simply removal redundant segment.
 */
function connectAdjacentBezier(segments1, segments2, origin, joinType, offset, limit, paperScope) {
    const curve1 = new paperScope.Curve(segments1[0], segments1[1]);
    const curve2 = new paperScope.Curve(segments2[0], segments2[1]);
    const intersection = curve1.getIntersections(curve2);
    const distance = segments1[1].point.getDistance(segments2[0].point);
    if (origin.isSmooth()) {
        segments2[0].handleOut = segments2[0].handleOut.project(origin.handleOut);
        segments2[0].handleIn = segments1[1].handleIn.project(origin.handleIn);
        segments2[0].point = segments1[1].point.add(segments2[0].point).divide(2);
        segments1.pop();
    }
    else {
        if (intersection.length === 0) {
            if (distance > Math.abs(offset) * 0.1) {
                // connect
                switch (joinType) {
                    case 'miter':
                        const join = getPointLineIntersections(curve1.point2, curve1.point2.add(curve1.getTangentAtTime(1)), curve2.point1, curve2.point1.add(curve2.getTangentAtTime(0)), paperScope);
                        // prevent sharp angle
                        const joinOffset = Math.max(join.getDistance(curve1.point2), join.getDistance(curve2.point1));
                        if (joinOffset < Math.abs(offset) * limit) {
                            segments1.push(new paperScope.Segment(join));
                        }
                        break;
                    case 'round':
                        const mid = makeRoundJoin(segments1[1], segments2[0], origin.point, offset, paperScope);
                        if (mid) {
                            segments1.push(mid);
                        }
                        break;
                }
            }
            else {
                segments2[0].handleIn = segments1[1].handleIn;
                segments1.pop();
            }
        }
        else {
            const second1 = curve1.divideAt(intersection[0]);
            if (second1) {
                const join = second1.segment1;
                const second2 = curve2.divideAt(curve2.getIntersections(curve1)[0]);
                join.handleOut = second2 ? second2.segment1.handleOut : segments2[0].handleOut;
                segments1.pop();
                segments2[0] = join;
            }
            else {
                segments2[0].handleIn = segments1[1].handleIn;
                segments1.pop();
            }
        }
    }
}
/**
 * Connect all the segments together.
 */
function connectBeziers(rawSegments, join, source, offset, limit, paperScope) {
    const originSegments = source.segments;
    const first = rawSegments[0].slice();
    for (let i = 0; i < rawSegments.length - 1; ++i) {
        connectAdjacentBezier(rawSegments[i], rawSegments[i + 1], originSegments[i + 1], join, offset, limit, paperScope);
    }
    if (source.closed) {
        connectAdjacentBezier(rawSegments[rawSegments.length - 1], first, originSegments[0], join, offset, limit, paperScope);
        rawSegments[0][0] = first[0];
    }
    return rawSegments;
}
function reduceSingleChildCompoundPath(path) {
    if (path.children.length === 1) {
        path = path.children[0];
        path.remove(); // remove from parent, this is critical, or the style attributes will be ignored
    }
    return path;
}
/** Normalize a path, always clockwise, non-self-intersection, ignore really small components, and no one-component compound path. */
function normalize(path, areaThreshold = 0.01, paperScope) {
    if (path.closed) {
        const ignoreArea = Math.abs(path.area * areaThreshold);
        if (!path.clockwise) {
            path.reverse();
        }
        path = path.unite(path, { insert: false });
        if (path instanceof paperScope.CompoundPath) {
            path.children.filter((c) => Math.abs(c.area) < ignoreArea).forEach((c) => c.remove());
            if (path.children.length === 1) {
                return reduceSingleChildCompoundPath(path);
            }
        }
    }
    return path;
}
function isSameDirection(partialPath, fullPath) {
    const offset1 = partialPath.segments[0].location.offset;
    const offset2 = partialPath.segments[Math.max(1, Math.floor(partialPath.segments.length / 2))].location.offset;
    const sampleOffset = (offset1 + offset2) / 3;
    const originOffset1 = fullPath.getNearestLocation(partialPath.getPointAt(sampleOffset)).offset;
    const originOffset2 = fullPath.getNearestLocation(partialPath.getPointAt(2 * sampleOffset)).offset;
    return originOffset1 < originOffset2;
}
/** Remove self intersection when offset is negative by point direction dectection. */
function removeIntersection(path, paperScope) {
    if (path.closed) {
        const newPath = path.unite(path, { insert: false });
        if (newPath instanceof paperScope.CompoundPath) {
            newPath.children.filter((c) => {
                if (c.segments.length > 1) {
                    return !isSameDirection(c, path);
                }
                else {
                    return true;
                }
            }).forEach((c) => c.remove());
            return reduceSingleChildCompoundPath(newPath);
        }
    }
    return path;
}
function getSegments(path, paperScope) {
    if (path instanceof paperScope.CompoundPath) {
        return path.children.map((c) => c.segments).flat();
    }
    else {
        return path.segments;
    }
}
/**
 * Remove impossible segments in negative offset condition.
 */
function removeOutsiders(newPath, path, paperScope) {
    const segments = getSegments(newPath, paperScope).slice();
    segments.forEach((segment) => {
        if (!path.contains(segment.point)) {
            segment.remove();
        }
    });
}
function preparePath(path, offset) {
    const source = path.clone({ insert: false });
    source.reduce({});
    if (!path.clockwise) {
        source.reverse();
        offset = -offset;
    }
    return [source, offset];
}
function offsetSimpleShape(path, offset, join, limit, paperScope) {
    let source;
    [source, offset] = preparePath(path, offset);
    const curves = source.curves.slice();
    const offsetCurves = curves.map((curve) => adaptiveOffsetCurve(curve, offset, paperScope)).flat();
    const raws = [];
    for (let i = 0; i < offsetCurves.length; i += 2) {
        raws.push(offsetCurves.slice(i, i + 2));
    }
    const segments = connectBeziers(raws, join, source, offset, limit, paperScope).flat();
    const newPath = removeIntersection(new paperScope.Path({ segments, insert: false, closed: path.closed }), paperScope);
    newPath.reduce({});
    if (source.closed && ((source.clockwise && offset < 0) || (!source.clockwise && offset > 0))) {
        removeOutsiders(newPath, path, paperScope);
    }
    // recovery path
    if (source.clockwise !== path.clockwise) {
        newPath.reverse();
    }
    return normalize(newPath, 0.01, paperScope);
}
function makeRoundCap(from, to, offset, paperScope) {
    const origin = from.point.add(to.point).divide(2);
    const normal = to.point.subtract(from.point).rotate(-90, new paperScope.Point(0, 0)).normalize(offset);
    const through = origin.add(normal);
    const arc = new paperScope.Path.Arc({ from: from.point, to: to.point, through, insert: false });
    return arc.segments;
}
function connectSide(outer, inner, offset, cap, paperScope) {
    if (outer instanceof paperScope.CompoundPath) {
        let cs = outer.children.map((c) => ({ c, a: Math.abs(c.area) }));
        cs = cs.sort((c1, c2) => c2.a - c1.a);
        outer = cs[0].c;
    }
    const oSegments = outer.segments.slice();
    const iSegments = inner.segments.slice();
    switch (cap) {
        case 'round':
            const heads = makeRoundCap(iSegments[iSegments.length - 1], oSegments[0], offset, paperScope);
            const tails = makeRoundCap(oSegments[oSegments.length - 1], iSegments[0], offset, paperScope);
            const result = new paperScope.Path({ segments: [...heads, ...oSegments, ...tails, ...iSegments], closed: true, insert: false });
            result.reduce({});
            return result;
        default: return new paperScope.Path({ segments: [...oSegments, ...iSegments], closed: true, insert: false });
    }
}
function offsetSimpleStroke(path, offset, join, cap, limit, paperScope) {
    offset = path.clockwise ? offset : -offset;
    const positiveOffset = offsetSimpleShape(path, offset, join, limit, paperScope);
    const negativeOffset = offsetSimpleShape(path, -offset, join, limit, paperScope);
    if (path.closed) {
        return positiveOffset.subtract(negativeOffset, { insert: false });
    }
    else {
        let inner = negativeOffset;
        let holes = new Array();
        if (negativeOffset instanceof paperScope.CompoundPath) {
            holes = negativeOffset.children.filter((c) => c.closed);
            holes.forEach((h) => h.remove());
            inner = negativeOffset.children[0];
        }
        inner.reverse();
        let final = connectSide(positiveOffset, inner, offset, cap, paperScope);
        if (holes.length > 0) {
            for (const hole of holes) {
                final = final.subtract(hole, { insert: false });
            }
        }
        return final;
    }
}
function getNonSelfItersectionPath(path) {
    if (path.closed) {
        return path.unite(path, { insert: false });
    }
    return path;
}
function offsetPath(path, offset, join, limit, paperScope) {
    const nonSIPath = getNonSelfItersectionPath(path);
    let result = nonSIPath;
    if (nonSIPath instanceof paperScope.Path) {
        result = offsetSimpleShape(nonSIPath, offset, join, limit, paperScope);
    }
    else {
        const offsetParts = nonSIPath.children.map((c) => {
            if (c.segments.length > 1) {
                if (!isSameDirection(c, path)) {
                    c.reverse();
                }
                let offseted = offsetSimpleShape(c, offset, join, limit, paperScope);
                offseted = normalize(offseted, 0.01, paperScope);
                if (offseted.clockwise !== c.clockwise) {
                    offseted.reverse();
                }
                if (offseted instanceof paperScope.CompoundPath) {
                    offseted.applyMatrix = true;
                    return offseted.children;
                }
                else {
                    return offseted;
                }
            }
            else {
                return null;
            }
        });
        const children = offsetParts.flat().filter((c) => !!c);
        result = new paperScope.CompoundPath({ children, insert: false });
    }
    result.copyAttributes(nonSIPath, false);
    result.remove();
    return result;
}
function offsetStroke(path, offset, join, cap, limit, paperScope) {
    const nonSIPath = getNonSelfItersectionPath(path);
    let result = nonSIPath;
    if (nonSIPath instanceof paperScope.Path) {
        result = offsetSimpleStroke(nonSIPath, offset, join, cap, limit, paperScope);
    }
    else {
        const children = nonSIPath.children.flatMap((c) => {
            return offsetSimpleStroke(c, offset, join, cap, limit, paperScope);
        });
        result = children.reduce((c1, c2) => c1.unite(c2, { insert: false }));
    }
    result.strokeWidth = 0;
    result.fillColor = nonSIPath.strokeColor;
    result.shadowBlur = nonSIPath.shadowBlur;
    result.shadowColor = nonSIPath.shadowColor;
    result.shadowOffset = nonSIPath.shadowOffset;
    return result;
}

class PaperOffset {
    static offset(path, offset, options) {
        if (!options || !options.scope) {
            throw new Error('Options need to be defined with a scope property referencing a Paperscope.');
        }
        const paperScope = options.scope;
        const newPath = offsetPath(path, offset, options.join || 'miter', options.limit || 10, paperScope);
        if (options.insert === undefined) {
            options.insert = true;
        }
        if (options.insert) {
            (path.parent || paperScope.project.activeLayer).addChild(newPath);
        }
        return newPath;
    }
    static offsetStroke(path, offset, options) {
        if (!options || !options.scope) {
            throw new Error('Options need to be defined with a scope property referencing a Paperscope.');
        }
        const paperScope = options.scope;
        const newPath = offsetStroke(path, offset, options.join || 'miter', options.cap || 'butt', options.limit || 10, paperScope);
        if (options.insert === undefined) {
            options.insert = true;
        }
        if (options.insert) {
            (path.parent || paperScope.project.activeLayer).addChild(newPath);
        }
        return newPath;
    }
}

export { PaperOffset };
//# sourceMappingURL=paperjs-offset-core.esm.js.map
