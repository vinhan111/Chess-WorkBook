declare module 'cm-chessboard/src/Chessboard.js' {
  export const COLOR: {
    white: 'w'
    black: 'b'
  }

  export const BORDER_TYPE: {
    none: 'none'
    thin: 'thin'
    frame: 'frame'
  }

  export const FEN: {
    start: string
    empty: string
  }

  export class Chessboard {
    constructor(context: HTMLElement, props?: Record<string, unknown>)
    setPosition(fen: string, animated?: boolean): Promise<void>
    setOrientation(color: 'w' | 'b', animated?: boolean): Promise<void>
    destroy(): void
  }
}
