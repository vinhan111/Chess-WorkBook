import { PDFDocument } from "pdf-lib";

type SideToMove = "White" | "Black";
type CoverStyle = "academy" | "minimal" | "tournament";
type DifficultyStyle = "king" | "queen" | "rook" | "knight" | "bishop" | "pawn";
type BoardTheme = "print" | "classic" | "blue" | "green" | "mono";
type PieceTheme = "standard" | "staunty";
type AnswerStyle = "standard" | "small-kid";
type Language = "en" | "vi";

type Puzzle = {
  id: string;
  number: number;
  prompt: string;
  sideToMove: SideToMove;
  fen: string;
  answer: string;
  rating?: string;
};

type ExportWorksheetState = {
  answerStyle?: AnswerStyle;
  boardTheme?: BoardTheme;
  className: string;
  coverStyle: CoverStyle;
  difficultyStyle: DifficultyStyle;
  fontFamily: string;
  fontSize: number;
  includeCover: boolean;
  instructions: string;
  language: Language;
  puzzles: Puzzle[];
  showPuzzlePrompts: boolean;
  gridColumns: number;
  gridRows: number;
  pieceTheme?: PieceTheme;
  showLogos: boolean;
  studentName: string;
  title: string;
  worksheetDate: string;
};

type ExportImagePdfOptions = {
  filename: string;
  scale?: number;
  state: ExportWorksheetState;
};

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 285;
const PX_PER_MM = 96 / 25.4;
const PAGE_WIDTH = PAGE_WIDTH_MM * PX_PER_MM;
const PAGE_HEIGHT = PAGE_HEIGHT_MM * PX_PER_MM;
const PAGE_PADDING = 10 * PX_PER_MM;
const BOARD_MAX_SIZE = 74 * PX_PER_MM;
const GRID_GAP = 3 * PX_PER_MM;
const ANSWER_HEIGHT = 13 * PX_PER_MM;
const SMALL_KID_ANSWER_HEIGHT = 7 * PX_PER_MM;
const LABEL_HEIGHT = 5 * PX_PER_MM;

const brandLogoPath = "/assets/cover/caissa-logo.jpg";

const difficultyAssets: Record<DifficultyStyle, string> = {
  king: "/assets/cover/king-silhouette.webp",
  queen: "/assets/cover/queen-silhouette.webp",
  rook: "/assets/cover/rook-bronze-cutout.png",
  knight: "/assets/cover/knight-blue-cutout.png",
  bishop: "/assets/cover/bishop-bronze-cutout.png",
  pawn: "/assets/cover/pawn-bronze-cutout.png",
};

const labels = {
  en: {
    answerNotation: "Answer notation",
    chessHomework: "Chess homework",
    chessHomeworkPack: "Chess homework pack",
    class: "Class",
    date: "Date",
    level: "Level",
    noPuzzlesSelected: "No puzzles selected.",
    page: "Page",
    puzzlesPages: "Puzzles / Pages",
    sideBlack: "Black",
    sideToMove: "Side to move",
    sideWhite: "White",
    student: "Student",
    titleFallback: "Untitled worksheet",
  },
  vi: {
    answerNotation: "Ô ghi đáp án",
    chessHomework: "Bài tập cờ vua",
    chessHomeworkPack: "Sổ bài tập cờ vua",
    class: "Lớp",
    date: "Ngày",
    level: "Độ khó",
    noPuzzlesSelected: "Chưa chọn bài nào.",
    page: "Trang",
    puzzlesPages: "Bài / Trang",
    sideBlack: "Đen",
    sideToMove: "Bên đi",
    sideWhite: "Trắng",
    student: "Học sinh",
    titleFallback: "Worksheet chưa đặt tên",
  },
} satisfies Record<Language, Record<string, string>>;

const difficultyLabels: Record<DifficultyStyle, Record<Language, string>> = {
  king: { en: "King", vi: "Vua" },
  queen: { en: "Queen", vi: "Hậu" },
  rook: { en: "Rook", vi: "Xe" },
  knight: { en: "Knight", vi: "Mã" },
  bishop: { en: "Bishop", vi: "Tượng" },
  pawn: { en: "Pawn", vi: "Tốt" },
};

const boardThemes: Record<
  BoardTheme,
  {
    coordinate: string;
    dark: string;
    frame: string;
    light: string;
    pattern: boolean;
  }
> = {
  print: {
    coordinate: "#64748b",
    dark: "#dfe6eb",
    frame: "#cbd5e1",
    light: "#ffffff",
    pattern: true,
  },
  classic: {
    coordinate: "#7c563b",
    dark: "#b9875f",
    frame: "#a77855",
    light: "#f1d9b5",
    pattern: false,
  },
  blue: {
    coordinate: "#315d74",
    dark: "#8fb7cd",
    frame: "#7aa4bc",
    light: "#edf6fb",
    pattern: false,
  },
  green: {
    coordinate: "#4f6538",
    dark: "#94ad73",
    frame: "#7f9864",
    light: "#eff6e9",
    pattern: false,
  },
  mono: {
    coordinate: "#475569",
    dark: "#cbd5e1",
    frame: "#94a3b8",
    light: "#ffffff",
    pattern: false,
  },
};

const pieceThemeFiles: Record<PieceTheme, string> = {
  standard: "/cm-chessboard/assets/pieces/standard.svg",
  staunty: "/cm-chessboard/assets/pieces/staunty.svg",
};

const pieceOrder = [
  "wk",
  "wq",
  "wr",
  "wb",
  "wn",
  "wp",
  "bk",
  "bq",
  "br",
  "bb",
  "bn",
  "bp",
];

const pieceImageCache = new Map<string, Promise<Record<string, HTMLImageElement>>>();

function sideLabel(side: SideToMove, language: Language) {
  return side === "Black"
    ? labels[language].sideBlack
    : labels[language].sideWhite;
}

function boardMaxSizeForGrid(columns: number, rows: number) {
  if (columns === 1 && rows === 1) {
    return 148 * PX_PER_MM;
  }

  if (columns <= 2 && rows <= 2) {
    return 92 * PX_PER_MM;
  }

  return BOARD_MAX_SIZE;
}

function answerHeightForStyle(answerStyle: AnswerStyle) {
  return answerStyle === "small-kid"
    ? SMALL_KID_ANSWER_HEIGHT
    : ANSWER_HEIGHT;
}

function makeCanvas(scale: number) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas export is not supported in this browser.");
  }

  canvas.width = Math.ceil(PAGE_WIDTH * scale);
  canvas.height = Math.ceil(PAGE_HEIGHT * scale);
  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  return { canvas, context };
}

function setFont(
  context: CanvasRenderingContext2D,
  size: number,
  family: string,
  weight = "400",
) {
  context.font = `${weight} ${size}px ${family}`;
  context.textBaseline = "top";
}

function wrapLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];

  for (const paragraph of `${text || ""}`.split(/\n+/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = "";

    for (const word of words) {
      const nextLine = line ? `${line} ${word}` : word;

      if (context.measureText(nextLine).width <= maxWidth || !line) {
        line = nextLine;
        continue;
      }

      lines.push(line);
      line = word;
    }

    if (line) {
      lines.push(line);
    }
  }

  return lines.length > 0 ? lines : [""];
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = Number.POSITIVE_INFINITY,
) {
  const lines = wrapLines(context, text, maxWidth).slice(0, maxLines);

  lines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });

  return lines.length * lineHeight;
}

function drawLine(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = "#111827",
  width = 1,
) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = width;
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
  context.restore();
}

function drawBox(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 0,
) {
  drawRoundedRectPath(context, x, y, width, height, radius);
  context.stroke();
}

function drawRoundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 0,
) {
  context.beginPath();

  if (radius > 0) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.arcTo(x + width, y, x + width, y + safeRadius, safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.arcTo(
      x + width,
      y + height,
      x + width - safeRadius,
      y + height,
      safeRadius,
    );
    context.lineTo(x + safeRadius, y + height);
    context.arcTo(x, y + height, x, y + height - safeRadius, safeRadius);
    context.lineTo(x, y + safeRadius);
    context.arcTo(x, y, x + safeRadius, y, safeRadius);
  } else {
    context.rect(x, y, width, height);
  }
}

function drawSoftShadow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 7,
) {
  context.save();
  context.fillStyle = "#ffffff";
  context.shadowBlur = 8;
  context.shadowColor = "rgba(15, 23, 42, 0.1)";
  context.shadowOffsetY = 2;
  drawRoundedRectPath(context, x, y, width, height, radius);
  context.fill();
  context.restore();
}

function drawImageContain(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!image || image.naturalWidth === 0 || image.naturalHeight === 0) {
    return;
  }

  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;

  context.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();

    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function loadCoverAssets() {
  const entries = await Promise.all(
    Object.entries(difficultyAssets).map(async ([key, src]) => [
      key,
      await loadImage(src),
    ]),
  );

  return {
    logo: await loadImage(brandLogoPath),
    pieces: Object.fromEntries(entries) as Record<
      DifficultyStyle,
      HTMLImageElement | null
    >,
  };
}

async function loadPieceImages(pieceTheme: PieceTheme) {
  const spritePath = pieceThemeFiles[pieceTheme];
  let cached = pieceImageCache.get(spritePath);

  if (!cached) {
    cached = (async () => {
      const response = await fetch(spritePath);

      if (!response.ok) {
        throw new Error("Unable to load chess piece sprite.");
      }

      return loadPieceImagesFromSprite(await response.text());
    })();
    pieceImageCache.set(spritePath, cached);
  }

  return cached;
}

async function loadPieceImagesFromSprite(spriteText: string) {
  const sprite = new DOMParser().parseFromString(spriteText, "image/svg+xml");
  const serializer = new XMLSerializer();
  const images: Record<string, HTMLImageElement> = {};

  await Promise.all(
    pieceOrder.map(async (piece) => {
      const node = sprite.getElementById(piece);

      if (!node) {
        return;
      }

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${serializer.serializeToString(node)}</svg>`;
      const image = await loadImage(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      );

      if (image) {
        images[piece] = image;
      }
    }),
  );

  return images;
}

function chunkPuzzles(puzzles: Puzzle[], size: number) {
  const chunks: Puzzle[][] = [];

  for (let index = 0; index < puzzles.length; index += size) {
    chunks.push(puzzles.slice(index, index + size));
  }

  return chunks;
}

function parseFenBoard(fen: string) {
  const board = fen.split(/\s+/)[0];
  return board.split("/").map((rank) => {
    const pieces: string[] = [];

    for (const character of rank) {
      const emptyCount = Number(character);

      if (Number.isInteger(emptyCount)) {
        pieces.push(...Array.from({ length: emptyCount }, () => ""));
      } else {
        pieces.push(character);
      }
    }

    return pieces;
  });
}

function pieceCodeFromFen(character: string) {
  if (!character) {
    return "";
  }

  return `${character === character.toUpperCase() ? "w" : "b"}${character.toLowerCase()}`;
}

function drawBoardPattern(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  context.strokeStyle = "rgba(15, 23, 42, 0.28)";
  context.lineWidth = 1;

  for (let offset = -size; offset < size; offset += 10) {
    context.beginPath();
    context.moveTo(x + offset, y + size);
    context.lineTo(x + offset + size, y);
    context.stroke();
  }
}

function drawChessBoard(
  context: CanvasRenderingContext2D,
  puzzle: Puzzle,
  x: number,
  y: number,
  size: number,
  boardTheme: BoardTheme,
  pieceImages: Record<string, HTMLImageElement>,
) {
  const board = parseFenBoard(puzzle.fen);
  const theme = boardThemes[boardTheme];
  const isBlackOrientation = puzzle.sideToMove === "Black";
  const frameSize = Math.max(8, size / 25);
  const innerX = x + frameSize;
  const innerY = y + frameSize;
  const innerSize = size - frameSize * 2;
  const squareSize = innerSize / 8;
  const files = Array.from({ length: 8 }, (_, index) =>
    String.fromCharCode((isBlackOrientation ? 104 - index : 97 + index)),
  );
  const ranks = Array.from({ length: 8 }, (_, index) =>
    String(isBlackOrientation ? index + 1 : 8 - index),
  );

  context.save();
  context.fillStyle = "#ffffff";
  context.fillRect(x, y, size, size);
  context.strokeStyle = "#e2e8f0";
  context.lineWidth = 0.8;
  context.strokeRect(x + 0.4, y + 0.4, size - 0.8, size - 0.8);
  context.strokeStyle = theme.frame;
  context.lineWidth = 1;
  context.strokeRect(innerX, innerY, innerSize, innerSize);

  const coordinateFontSize = Math.max(6, frameSize * 0.45);
  context.fillStyle = theme.coordinate;
  setFont(context, coordinateFontSize, "Arial, sans-serif", "700");
  context.textAlign = "center";
  files.forEach((file, index) => {
    context.fillText(
      file,
      innerX + squareSize * (index + 0.5),
      y + size - frameSize + (frameSize - coordinateFontSize) / 2,
    );
  });

  ranks.forEach((rank, index) => {
    context.fillText(
      rank,
      x + frameSize / 2,
      innerY + squareSize * (index + 0.5) - coordinateFontSize / 2,
    );
  });

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const squareX = innerX + column * squareSize;
      const squareY = innerY + row * squareSize;
      const dark = (row + column) % 2 === 1;

      context.fillStyle = dark ? theme.dark : theme.light;
      context.fillRect(squareX, squareY, squareSize, squareSize);

      if (dark && theme.pattern) {
        context.save();
        context.beginPath();
        context.rect(squareX, squareY, squareSize, squareSize);
        context.clip();
        drawBoardPattern(context, squareX, squareY, squareSize);
        context.restore();
      }

      const fenRow = isBlackOrientation ? 7 - row : row;
      const fenColumn = isBlackOrientation ? 7 - column : column;
      const piece = pieceCodeFromFen(board[fenRow]?.[fenColumn] ?? "");
      const pieceImage = piece ? pieceImages[piece] : undefined;

      if (pieceImage) {
        const padding = squareSize * 0.08;
        context.drawImage(
          pieceImage,
          squareX + padding,
          squareY + padding,
          squareSize - padding * 2,
          squareSize - padding * 2,
        );
      }
    }
  }

  context.strokeStyle = theme.frame;
  context.lineWidth = 1;
  context.strokeRect(innerX, innerY, innerSize, innerSize);
  context.textAlign = "start";
  context.restore();
}

function drawCover(
  context: CanvasRenderingContext2D,
  state: ExportWorksheetState,
  assets: Awaited<ReturnType<typeof loadCoverAssets>>,
  worksheetPageCount: number,
) {
  const t = labels[state.language];
  const borderColor =
    state.coverStyle === "tournament"
      ? "#6b3135"
      : state.coverStyle === "minimal"
        ? "#111827"
        : "#184d5f";

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.fillStyle = borderColor;
  context.fillRect(0, 0, PAGE_WIDTH, 12);

  if (state.showLogos) {
    context.fillStyle = "#fffdf0";
    context.strokeStyle = "rgba(15, 23, 42, 0.1)";
    drawBox(context, PAGE_PADDING, PAGE_PADDING, 96, 96, 12);
    drawImageContain(
      context,
      assets.logo,
      PAGE_PADDING + 8,
      PAGE_PADDING + 8,
      80,
      80,
    );
  }

  context.save();
  context.globalAlpha =
    state.difficultyStyle === "king" || state.difficultyStyle === "queen"
      ? 0.34
      : 0.25;
  drawImageContain(
    context,
    assets.pieces[state.difficultyStyle],
    PAGE_WIDTH - PAGE_PADDING - 320,
    PAGE_HEIGHT - PAGE_PADDING - 610,
    320,
    610,
  );
  context.restore();

  const copyX = PAGE_PADDING;
  const copyY = PAGE_PADDING + 125;

  context.fillStyle = "#475569";
  setFont(context, 10, state.fontFamily, "800");
  context.fillText(t.chessHomeworkPack.toUpperCase(), copyX, copyY);

  context.fillStyle = "#0f172a";
  setFont(context, 46, state.fontFamily, "800");
  const titleHeight = drawWrappedText(
    context,
    state.title || "Chess Tactics Homework",
    copyX,
    copyY + 30,
    PAGE_WIDTH * 0.66,
    50,
    3,
  );

  context.fillStyle = "#324254";
  setFont(context, 17, state.fontFamily);
  drawWrappedText(
    context,
    state.instructions,
    copyX,
    copyY + 42 + titleHeight,
    PAGE_WIDTH * 0.66,
    25,
    4,
  );

  const metaY = PAGE_HEIGHT - PAGE_PADDING - 98;
  const metaGap = 14;
  const metaColumns = [220, 190, 82, 82];
  const metaItems = [
    [t.class, state.className],
    [t.date, state.worksheetDate],
    [t.level, difficultyLabels[state.difficultyStyle][state.language]],
    [t.puzzlesPages, `${state.puzzles.length} / ${worksheetPageCount}`],
  ];
  let metaX = PAGE_PADDING;

  drawLine(context, PAGE_PADDING, metaY, PAGE_WIDTH - PAGE_PADDING, metaY, "#111827", 2);
  metaItems.forEach(([label, value], index) => {
    const width = metaColumns[index];

    context.fillStyle = "#536273";
    setFont(context, 10, state.fontFamily, "800");
    context.fillText(label.toUpperCase(), metaX, metaY + 16);
    context.fillStyle = "#111827";
    setFont(context, 16, state.fontFamily);
    context.fillText(value || "", metaX, metaY + 44);
    drawLine(context, metaX, metaY + 78, metaX + width, metaY + 78);
    metaX += width + metaGap;
  });
}

function drawStudentMeta(
  context: CanvasRenderingContext2D,
  state: ExportWorksheetState,
  x: number,
  y: number,
) {
  const t = labels[state.language];
  const rows = [
    [t.student, state.studentName],
    [t.class, state.className],
    [t.date, state.worksheetDate],
  ];

  rows.forEach(([label, value], index) => {
    const rowY = y + index * 37;

    context.fillStyle = "#475569";
    setFont(context, 10, state.fontFamily, "800");
    context.fillText(label.toUpperCase(), x, rowY + 8);
    context.fillStyle = "#111827";
    setFont(context, 14, state.fontFamily);
    context.fillText(value || "", x + 60, rowY + 6);
    drawLine(context, x, rowY + 28, x + 185, rowY + 28, "#1f2937", 1);
  });
}

function drawWorksheetHeader(
  context: CanvasRenderingContext2D,
  state: ExportWorksheetState,
  pageIndex: number,
  totalPages: number,
  logo: HTMLImageElement | null,
) {
  const t = labels[state.language];
  const headerY = PAGE_PADDING;
  const metaWidth = 198;
  const leftWidth = PAGE_WIDTH - PAGE_PADDING * 2 - metaWidth - 24;

  context.fillStyle = "#475569";
  setFont(context, 10, state.fontFamily, "800");
  context.fillText(
    `${t.chessHomework} · ${t.page} ${pageIndex + 1} / ${totalPages}`.toUpperCase(),
    PAGE_PADDING,
    headerY,
  );

  if (state.showLogos) {
    context.fillStyle = "#fffdf0";
    context.strokeStyle = "rgba(15, 23, 42, 0.1)";
    drawBox(context, PAGE_PADDING + leftWidth - 44, headerY, 44, 44, 7);
    drawImageContain(context, logo, PAGE_PADDING + leftWidth - 40, headerY + 4, 36, 36);
  }

  context.fillStyle = "#0f172a";
  setFont(context, 30, state.fontFamily, "800");
  drawWrappedText(
    context,
    state.title || t.titleFallback,
    PAGE_PADDING,
    headerY + 24,
    leftWidth - (state.showLogos ? 52 : 0),
    33,
    2,
  );

  context.fillStyle = "#263241";
  setFont(context, 13, state.fontFamily);
  drawWrappedText(
    context,
    state.instructions,
    PAGE_PADDING,
    headerY + 88,
    leftWidth,
    18,
    2,
  );

  drawStudentMeta(
    context,
    state,
    PAGE_WIDTH - PAGE_PADDING - metaWidth,
    headerY,
  );

  drawLine(
    context,
    PAGE_PADDING,
    headerY + 124,
    PAGE_WIDTH - PAGE_PADDING,
    headerY + 124,
    "#111827",
    2,
  );

  return headerY + 138;
}

function drawAnswerBox(
  context: CanvasRenderingContext2D,
  puzzle: Puzzle,
  state: ExportWorksheetState,
  x: number,
  y: number,
  width: number,
) {
  const t = labels[state.language];
  const answerStyle = state.answerStyle ?? "standard";

  if (answerStyle === "small-kid") {
    context.fillStyle = "#334155";
    setFont(context, 11, state.fontFamily, "800");
    context.fillText(
      `${t.sideToMove}: ${sideLabel(puzzle.sideToMove, state.language)}`,
      x,
      y + 2,
    );
    return;
  }

  const sideWidth = 0.82 * 96;
  const gap = 7;
  const radius = 7;

  drawSoftShadow(context, x, y, sideWidth, ANSWER_HEIGHT, radius);
  drawSoftShadow(
    context,
    x + sideWidth + gap,
    y,
    width - sideWidth - gap,
    ANSWER_HEIGHT,
    radius,
  );

  context.fillStyle = "#ffffff";
  context.fillRect(x, y, sideWidth, ANSWER_HEIGHT);
  context.fillRect(x + sideWidth + gap, y, width - sideWidth - gap, ANSWER_HEIGHT);
  context.strokeStyle = "#111827";
  context.lineWidth = 1;
  drawBox(context, x, y, sideWidth, ANSWER_HEIGHT, radius);
  drawBox(
    context,
    x + sideWidth + gap,
    y,
    width - sideWidth - gap,
    ANSWER_HEIGHT,
    radius,
  );

  context.fillStyle = "#475569";
  setFont(context, 8, state.fontFamily, "800");
  context.fillText(t.sideToMove.toUpperCase(), x + 6, y + 6);
  context.fillText(t.answerNotation.toUpperCase(), x + sideWidth + gap + 6, y + 6);

  context.fillStyle = "#111827";
  setFont(context, 12, state.fontFamily, "800");
  context.fillText(sideLabel(puzzle.sideToMove, state.language), x + 6, y + 24);
}

function drawPuzzleCard(
  context: CanvasRenderingContext2D,
  state: ExportWorksheetState,
  puzzle: Puzzle,
  globalIndex: number,
  x: number,
  y: number,
  width: number,
  height: number,
  boardTheme: BoardTheme,
  pieceImages: Record<string, HTMLImageElement>,
) {
  const padding = 9;
  const answerHeight = answerHeightForStyle(state.answerStyle ?? "standard");
  let promptHeight = LABEL_HEIGHT;

  if (state.showPuzzlePrompts) {
    setFont(context, 12, state.fontFamily, "800");
    const promptLines = wrapLines(context, puzzle.prompt, width - padding * 2).slice(
      0,
      3,
    );
    promptHeight = Math.max(54, promptLines.length * 15 + 12);
  }

  const innerWidth = width - padding * 2;
  const boardAreaTop = y + padding + promptHeight + 4;
  const boardAreaHeight =
    height - padding * 2 - promptHeight - answerHeight - 10;
  const boardMaxSize = boardMaxSizeForGrid(state.gridColumns, state.gridRows);
  const boardSize = Math.max(
    30,
    Math.min(innerWidth, boardMaxSize, boardAreaHeight),
  );
  const boardX = x + padding + (innerWidth - boardSize) / 2;
  const boardY = boardAreaTop + Math.max(0, (boardAreaHeight - boardSize) / 2);
  const answerY = y + height - padding - answerHeight;

  context.strokeStyle = "#475569";
  context.lineWidth = 1;
  drawBox(context, x, y, width, height, 7);

  if (state.showPuzzlePrompts) {
    context.fillStyle = "#111827";
    setFont(context, 12, state.fontFamily, "800");
    drawWrappedText(context, puzzle.prompt, x + padding, y + padding, innerWidth, 15, 3);
  } else {
    context.fillStyle = "#334155";
    setFont(context, 13, state.fontFamily, "900");
    context.fillText(`#${globalIndex + 1}`, x + padding, y + padding);
  }

  drawChessBoard(
    context,
    puzzle,
    boardX,
    boardY,
    boardSize,
    boardTheme,
    pieceImages,
  );
  drawAnswerBox(context, puzzle, state, x + padding, answerY, innerWidth);
}

function drawEmptyWorksheet(
  context: CanvasRenderingContext2D,
  state: ExportWorksheetState,
  logo: HTMLImageElement | null,
) {
  drawWorksheetHeader(context, state, 0, 1, logo);
  context.fillStyle = "#64748b";
  setFont(context, 20, state.fontFamily, "800");
  context.fillText(
    labels[state.language].noPuzzlesSelected,
    PAGE_WIDTH / 2 - 90,
    PAGE_HEIGHT / 2,
  );
}

function drawWorksheet(
  context: CanvasRenderingContext2D,
  state: ExportWorksheetState,
  pagePuzzles: Puzzle[],
  pageIndex: number,
  totalPages: number,
  logo: HTMLImageElement | null,
  pieceImages: Record<string, HTMLImageElement>,
) {
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  const gridTop = drawWorksheetHeader(context, state, pageIndex, totalPages, logo);
  const columns = Math.max(1, state.gridColumns);
  const rows = Math.max(1, state.gridRows);
  const contentWidth = PAGE_WIDTH - PAGE_PADDING * 2;
  const contentHeight = PAGE_HEIGHT - PAGE_PADDING - gridTop;
  const cardWidth = (contentWidth - GRID_GAP * (columns - 1)) / columns;
  const cardHeight = (contentHeight - GRID_GAP * (rows - 1)) / rows;
  const boardTheme = state.boardTheme ?? "print";

  pagePuzzles.forEach((puzzle, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;

    drawPuzzleCard(
      context,
      state,
      puzzle,
      pageIndex * columns * rows + index,
      PAGE_PADDING + column * (cardWidth + GRID_GAP),
      gridTop + row * (cardHeight + GRID_GAP),
      cardWidth,
      cardHeight,
      boardTheme,
      pieceImages,
    );
  });
}

async function canvasToPngBytes(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
        return;
      }

      reject(new Error("Unable to create PNG export page."));
    }, "image/png");
  });

  return new Uint8Array(await blob.arrayBuffer());
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function addCanvasPage(pdf: PDFDocument, canvas: HTMLCanvasElement) {
  const png = await canvasToPngBytes(canvas);
  const embeddedPage = await pdf.embedPng(png);
  const pdfPage = pdf.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
  const imageHeight = A4_WIDTH_PT * (embeddedPage.height / embeddedPage.width);

  pdfPage.drawImage(embeddedPage, {
    height: imageHeight,
    width: A4_WIDTH_PT,
    x: 0,
    y: A4_HEIGHT_PT - imageHeight,
  });
}

export async function exportPrintDocumentToImagePdf({
  filename,
  scale = 2,
  state,
}: ExportImagePdfOptions) {
  const safeScale = Math.min(4, Math.max(1, scale));
  const pieceTheme = state.pieceTheme ?? "standard";
  await document.fonts?.ready;
  const [coverAssets, pieceImages] = await Promise.all([
    loadCoverAssets(),
    loadPieceImages(pieceTheme),
  ]);
  const puzzlesPerPage = Math.max(1, state.gridColumns * state.gridRows);
  const worksheetPages = chunkPuzzles(state.puzzles, puzzlesPerPage);
  const pdf = await PDFDocument.create();

  if (state.includeCover) {
    const { canvas, context } = makeCanvas(safeScale);
    drawCover(context, state, coverAssets, worksheetPages.length);
    await addCanvasPage(pdf, canvas);
  }

  if (worksheetPages.length === 0) {
    const { canvas, context } = makeCanvas(safeScale);
    drawEmptyWorksheet(context, state, coverAssets.logo);
    await addCanvasPage(pdf, canvas);
  } else {
    for (const [pageIndex, pagePuzzles] of worksheetPages.entries()) {
      const { canvas, context } = makeCanvas(safeScale);
      drawWorksheet(
        context,
        state,
        pagePuzzles,
        pageIndex,
        worksheetPages.length,
        coverAssets.logo,
        pieceImages,
      );
      await addCanvasPage(pdf, canvas);
    }
  }

  const bytes = await pdf.save();
  const pdfBytes = new Uint8Array(bytes.length);
  pdfBytes.set(bytes);
  downloadBlob(new Blob([pdfBytes.buffer], { type: "application/pdf" }), filename);
}
