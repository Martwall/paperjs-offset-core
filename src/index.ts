import type paper from 'paper/dist/paper-core';
import { StrokeJoinType, PathType, StrokeCapType, offsetPath, offsetStroke } from './offset_core';

export interface OffsetOptions {
  join?: StrokeJoinType;
  cap?: StrokeCapType;
  limit?: number;
  insert?: boolean;
  scope: paper.PaperScope;
}

export class PaperOffset {
  public static offset(path: PathType, offset: number, options?: OffsetOptions): PathType {
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

  public static offsetStroke(path: PathType, offset: number, options?: OffsetOptions): PathType {
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
