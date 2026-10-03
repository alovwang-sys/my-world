// Based on https://codepen.io/inlet/pen/yLVmPWv.
// Copyright (c) 2018 Patrick Brouwer, distributed under the MIT license.

import { PixiComponent } from '@pixi/react';
import { Viewport } from 'pixi-viewport';
import { Application } from 'pixi.js';
import { MutableRefObject, ReactNode } from 'react';

export type ViewportProps = {
  app: Application;
  viewportRef?: MutableRefObject<Viewport | undefined>;

  screenWidth: number;
  screenHeight: number;
  worldWidth: number;
  worldHeight: number;
  children?: ReactNode;
};

// https://davidfig.github.io/pixi-viewport/jsdoc/Viewport.html
export default PixiComponent('Viewport', {
  create(props: ViewportProps) {
    const { app, children: _children, viewportRef, ...viewportProps } = props;
    const viewport = new Viewport({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      events: app.renderer.events,
      passiveWheel: false,
      ...viewportProps,
    });
    if (viewportRef) {
      viewportRef.current = viewport;
    }
    // Activate plugins
    viewport.drag().pinch({}).wheel().decelerate().clamp({ direction: 'all', underflow: 'center' });
    if (props.screenWidth > 0 && props.screenHeight > 0) viewport.fitWorld(true);
    else viewport.moveCenter(props.worldWidth / 2, props.worldHeight / 2);
    viewport.clampZoom({
      minScale: Math.min(
        props.screenWidth / props.worldWidth,
        props.screenHeight / props.worldHeight,
      ),
      maxScale: 3.0,
    });
    return viewport;
  },
  applyProps(viewport, oldProps: ViewportProps, newProps: ViewportProps) {
    if (
      oldProps.screenWidth !== newProps.screenWidth ||
      oldProps.screenHeight !== newProps.screenHeight
    ) {
      const center = viewport.center;
      viewport.resize(
        newProps.screenWidth,
        newProps.screenHeight,
        newProps.worldWidth,
        newProps.worldHeight,
      );
      viewport.clampZoom({
        minScale: Math.min(
          newProps.screenWidth / newProps.worldWidth,
          newProps.screenHeight / newProps.worldHeight,
        ),
        maxScale: 3,
      });
      if (oldProps.screenWidth > 0 && oldProps.screenHeight > 0) viewport.moveCenter(center);
      else viewport.fitWorld(true);
    }
  },
});
