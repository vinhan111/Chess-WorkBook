import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import {
  BORDER_TYPE,
  COLOR,
  Chessboard,
  FEN,
} from "cm-chessboard/src/Chessboard.js";
import "cm-chessboard/assets/chessboard.css";
import firstPuzzlePackPgn from "./data/first-puzzle-pack.pgn?raw";
import "./App.css";

type SideToMove = "White" | "Black";

type Puzzle = {
  id: string;
  number: number;
  prompt: string;
  sideToMove: SideToMove;
  fen: string;
  answer: string;
  rating?: string;
};

type CoverStyle = "academy" | "minimal" | "tournament";
type DifficultyStyle = "king" | "queen" | "rook" | "knight" | "bishop" | "pawn";
type BoardTheme = "print" | "classic" | "blue" | "green" | "mono";
type PieceTheme = "standard" | "staunty";
type AnswerStyle = "standard" | "small-kid";
type Language = "en" | "vi";

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

declare global {
  interface Window {
    __WORKSHEET_EXPORT_READY?: boolean;
  }
}

const MAX_BOOK_PAGES = 1000;
const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const fontOptions = [
  {
    label: "Inter / System",
    value:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Classroom", value: "'Trebuchet MS', 'Segoe UI', sans-serif" },
  { label: "Mono", value: "'Courier New', ui-monospace, monospace" },
];

const coverOptions: Array<{ label: string; value: CoverStyle }> = [
  { label: "Academy cover", value: "academy" },
  { label: "Minimal cover", value: "minimal" },
  { label: "Tournament cover", value: "tournament" },
];

const boardThemeOptions: Array<{
  labels: Record<Language, string>;
  value: BoardTheme;
}> = [
  { labels: { en: "Print saver", vi: "Tiết kiệm mực" }, value: "print" },
  { labels: { en: "Classic wood", vi: "Gỗ cổ điển" }, value: "classic" },
  { labels: { en: "Blue board", vi: "Bàn xanh dương" }, value: "blue" },
  { labels: { en: "Green board", vi: "Bàn xanh lá" }, value: "green" },
  { labels: { en: "Mono ink", vi: "Đen trắng" }, value: "mono" },
];

const pieceThemeOptions: Array<{
  labels: Record<Language, string>;
  value: PieceTheme;
}> = [
  { labels: { en: "Standard", vi: "Chuẩn" }, value: "standard" },
  { labels: { en: "Staunty", vi: "Staunty" }, value: "staunty" },
];

const answerStyleOptions: Array<{
  labels: Record<Language, string>;
  value: AnswerStyle;
}> = [
  { labels: { en: "Standard", vi: "Tiêu chuẩn" }, value: "standard" },
  { labels: { en: "Small kid", vi: "Trẻ nhỏ" }, value: "small-kid" },
];

const boardThemeClassNames: Record<BoardTheme, string> = {
  print: "board-theme-print",
  classic: "board-theme-classic",
  blue: "board-theme-blue",
  green: "board-theme-green",
  mono: "board-theme-mono",
};

const pieceThemeFiles: Record<PieceTheme, string> = {
  standard: "pieces/standard.svg",
  staunty: "pieces/staunty.svg",
};

const brandLogoPath = "/assets/cover/caissa-logo.jpg";

const translations = {
  en: {
    answerStyle: "Answer style",
    answerNotation: "Answer notation",
    boardTheme: "Board theme",
    bookPages: "Book pages",
    buildFirstPage: (count: number) =>
      `Build first ${count} page${count === 1 ? "" : "s"}`,
    chessHomework: "Chess homework",
    chessHomeworkPack: "Chess homework pack",
    class: "Class",
    clear: "Clear",
    columns: "Columns",
    coverDesign: "Cover design",
    date: "Date",
    difficultyArt: "Difficulty art",
    exportImagePdf: "Export Image PDF",
    exportingImagePdf: "Exporting image PDF...",
    firstPuzzlePack: "First puzzle pack",
    firstPuzzlePackInfo: (count: number) =>
      `${count} FEN puzzles saved from part_001.pgn.`,
    font: "Font",
    imagePdfFailed: "Image PDF export failed.",
    importPastedPgn: "Import pasted PGN",
    includeCoverPage: "Include cover page",
    instructions: "Instructions",
    language: "Language",
    leaveBlankForStudents: "Leave blank for students",
    level: "Level",
    loadFirstPage: "Load first page",
    noPuzzlesSelected: "No puzzles selected.",
    noRating: "No rating",
    noValidFen:
      "No valid FEN puzzle positions found. This phase supports PGN puzzle packs with FEN tags.",
    page: "Page",
    panelCopy:
      "Upload or paste a FEN-tagged PGN puzzle pack, then build a worksheet book with 9 puzzles per page.",
    pastePgn: "Paste PGN",
    pastePgnPlaceholder: "Paste PGN with FEN tags here...",
    phase: "Made with love by Thầy An - Phase 3",
    pieceSet: "Piece set",
    printSavePdf: "Print / Save PDF",
    sectionExport: "Export",
    sectionLoad: "Load setup",
    sectionTheme: "Theme",
    sectionWorksheet: "Worksheet",
    puzzlePrompt: (count: number) => `Puzzle ${count} prompt`,
    puzzlesImported: (count: number) =>
      `${count} puzzles imported. First 9 selected for the worksheet.`,
    puzzlesPerPage: (count: number) => `${count} puzzles per page.`,
    puzzlesPages: "Puzzles / Pages",
    rating: "Rating",
    rows: "Rows",
    selectFirstPage: "Select first page",
    selected: "selected",
    showLogos: "Show all logos",
    showPuzzlePromptText: "Show puzzle prompt text",
    sideBlack: "Black",
    sideToMove: "Side to move",
    sideWhite: "White",
    size: "Size",
    student: "Student",
    titleFallback: "Untitled worksheet",
    uploadPgnPuzzlePack: "Upload PGN puzzle pack",
    worksheetBuilder: "Chess worksheet builder",
    worksheetTitle: "Worksheet title",
  },
  vi: {
    answerStyle: "Kiểu đáp án",
    answerNotation: "Ô ghi đáp án",
    boardTheme: "Màu bàn cờ",
    bookPages: "Số trang sách",
    buildFirstPage: (count: number) => `Tạo ${count} trang đầu`,
    chessHomework: "Bài tập cờ vua",
    chessHomeworkPack: "Sổ bài tập cờ vua",
    class: "Lớp",
    clear: "Bỏ chọn",
    columns: "Cột",
    coverDesign: "Mẫu bìa",
    date: "Ngày",
    difficultyArt: "Hình độ khó",
    exportImagePdf: "Xuất PDF dạng ảnh",
    exportingImagePdf: "Đang xuất PDF ảnh...",
    firstPuzzlePack: "Bộ bài đầu tiên",
    firstPuzzlePackInfo: (count: number) =>
      `${count} bài có FEN đã lưu từ part_001.pgn.`,
    font: "Phông chữ",
    imagePdfFailed: "Xuất PDF dạng ảnh thất bại.",
    importPastedPgn: "Nhập PGN đã dán",
    includeCoverPage: "Thêm trang bìa",
    instructions: "Hướng dẫn",
    language: "Ngôn ngữ",
    leaveBlankForStudents: "Để trống cho học sinh",
    level: "Độ khó",
    loadFirstPage: "Tải trang đầu",
    noPuzzlesSelected: "Chưa chọn bài nào.",
    noRating: "Chưa có rating",
    noValidFen:
      "Không tìm thấy thế cờ FEN hợp lệ. Giai đoạn này hỗ trợ PGN có tag FEN.",
    page: "Trang",
    panelCopy:
      "Tải lên hoặc dán bộ bài PGN có FEN, rồi tạo tập bài in với 9 bài mỗi trang.",
    pastePgn: "Dán PGN",
    pastePgnPlaceholder: "Dán PGN có tag FEN vào đây...",
    phase: "Made with love by Thầy An - Giai đoạn 3",
    pieceSet: "Bộ quân cờ",
    printSavePdf: "In / Lưu PDF",
    sectionExport: "Xuất file",
    sectionLoad: "Nạp dữ liệu",
    sectionTheme: "Giao diện",
    sectionWorksheet: "Bố cục",
    puzzlePrompt: (count: number) => `Đề bài ${count}`,
    puzzlesImported: (count: number) =>
      `Đã nhập ${count} bài. 9 bài đầu đã được chọn cho worksheet.`,
    puzzlesPerPage: (count: number) => `${count} bài mỗi trang.`,
    puzzlesPages: "Bài / Trang",
    rating: "Rating",
    rows: "Hàng",
    selectFirstPage: "Chọn trang đầu",
    selected: "đã chọn",
    showLogos: "Hiện tất cả logo",
    showPuzzlePromptText: "Hiện dòng đề bài",
    sideBlack: "Đen",
    sideToMove: "Bên đi",
    sideWhite: "Trắng",
    size: "Cỡ chữ",
    student: "Học sinh",
    titleFallback: "Worksheet chưa đặt tên",
    uploadPgnPuzzlePack: "Tải bộ bài PGN",
    worksheetBuilder: "Trình tạo bài tập cờ vua",
    worksheetTitle: "Tên worksheet",
  },
} satisfies Record<
  Language,
  Record<string, string | ((value: number) => string)>
>;

const difficultyOptions: Array<{
  label: string;
  pieceLabel: string;
  src: string;
  value: DifficultyStyle;
}> = [
  {
    label: "Pawn / starter",
    pieceLabel: "Pawn",
    src: "/assets/cover/pawn-bronze-cutout.png",
    value: "pawn",
  },
  {
    label: "Bishop / easy",
    pieceLabel: "Bishop",
    src: "/assets/cover/bishop-bronze-cutout.png",
    value: "bishop",
  },
  {
    label: "Knight / practice",
    pieceLabel: "Knight",
    src: "/assets/cover/knight-blue-cutout.png",
    value: "knight",
  },
  {
    label: "Rook / medium",
    pieceLabel: "Rook",
    src: "/assets/cover/rook-bronze-cutout.png",
    value: "rook",
  },
  {
    label: "Queen / hard",
    pieceLabel: "Queen",
    src: "/assets/cover/queen-silhouette.webp",
    value: "queen",
  },
  {
    label: "King / hardest",
    pieceLabel: "King",
    src: "/assets/cover/king-silhouette.webp",
    value: "king",
  },
];

function sideLabel(side: SideToMove, language: Language) {
  return side === "Black"
    ? translations[language].sideBlack
    : translations[language].sideWhite;
}

function coverStyleLabel(style: CoverStyle, language: Language) {
  const labels: Record<CoverStyle, Record<Language, string>> = {
    academy: { en: "Academy cover", vi: "Bìa lớp học" },
    minimal: { en: "Minimal cover", vi: "Bìa tối giản" },
    tournament: { en: "Tournament cover", vi: "Bìa thi đấu" },
  };

  return labels[style][language];
}

function difficultyLabel(style: DifficultyStyle, language: Language) {
  const labels: Record<
    DifficultyStyle,
    Record<Language, { option: string; piece: string }>
  > = {
    king: {
      en: { option: "King / hardest", piece: "King" },
      vi: { option: "Vua / khó nhất", piece: "Vua" },
    },
    queen: {
      en: { option: "Queen / hard", piece: "Queen" },
      vi: { option: "Hậu / khó", piece: "Hậu" },
    },
    rook: {
      en: { option: "Rook / medium", piece: "Rook" },
      vi: { option: "Xe / trung bình", piece: "Xe" },
    },
    knight: {
      en: { option: "Knight / practice", piece: "Knight" },
      vi: { option: "Mã / luyện tập", piece: "Mã" },
    },
    bishop: {
      en: { option: "Bishop / easy", piece: "Bishop" },
      vi: { option: "Tượng / dễ", piece: "Tượng" },
    },
    pawn: {
      en: { option: "Pawn / starter", piece: "Pawn" },
      vi: { option: "Tốt / nhập môn", piece: "Tốt" },
    },
  };

  return labels[style][language];
}

function defaultPuzzlePrompt(
  number: number,
  rating: string | undefined,
  language: Language,
) {
  if (language === "vi") {
    return `Bài ${number}${rating ? ` (${rating})` : ""}: Tìm nước đi tốt nhất.`;
  }

  return `Puzzle ${number}${rating ? ` (${rating})` : ""}: Find the best move.`;
}

function localizePrompt(puzzle: Puzzle, language: Language) {
  const englishDefault = defaultPuzzlePrompt(
    puzzle.number,
    puzzle.rating,
    "en",
  );

  if (puzzle.prompt === englishDefault) {
    return defaultPuzzlePrompt(puzzle.number, puzzle.rating, language);
  }

  return puzzle.prompt;
}

function defaultInstructions(language: Language) {
  if (language === "vi") {
    return "Viết nước đi tốt nhất bằng ký hiệu cờ vua dưới mỗi bàn cờ. Ghi rõ nước đi đầu tiên.";
  }

  return "Write the best move in chess notation under each board. Show the first move clearly.";
}

function bundledPackMessage(language: Language) {
  return language === "vi" ? "Đã tải bộ bài có sẵn." : "Bundled pack loaded.";
}

function sideFromFen(fen: string): SideToMove {
  return fen.split(/\s+/)[1] === "b" ? "Black" : "White";
}

function parseHeaders(block: string) {
  return Array.from(block.matchAll(/^\[(\w+)\s+"([^"]*)"\]$/gm)).reduce<
    Record<string, string>
  >((headers, match) => {
    headers[match[1]] = match[2];
    return headers;
  }, {});
}

function parseFirstMove(block: string) {
  const moveText = block
    .replace(/^\[[^\n]+\]\s*$/gm, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\$\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const match = moveText.match(/^(?:\d+\.(?:\.\.)?\s*)?([^\s]+)/);
  return match?.[1]?.replace(/\*$/, "") || "";
}

function parsePuzzlePack(pgn: string, sourceKey = "pack"): Puzzle[] {
  return pgn
    .split(/\n(?=\[Event\s)/)
    .map((block, index): Puzzle | null => {
      const headers = parseHeaders(block);
      const fen = headers.FEN;

      if (!fen) {
        return null;
      }

      try {
        new Chess(fen);
      } catch {
        return null;
      }

      const rating = headers.Rating || undefined;
      return {
        id: `${sourceKey}-${index + 1}`,
        number: index + 1,
        fen,
        rating,
        answer: parseFirstMove(block),
        sideToMove: sideFromFen(fen),
        prompt: defaultPuzzlePrompt(index + 1, rating, "en"),
      };
    })
    .filter((puzzle): puzzle is Puzzle => puzzle !== null);
}

function chunkPuzzles(puzzles: Puzzle[], size: number) {
  const chunks: Puzzle[][] = [];

  for (let index = 0; index < puzzles.length; index += size) {
    chunks.push(puzzles.slice(index, index + size));
  }

  return chunks;
}

function boardMaxSizeValue(columns: number, rows: number) {
  if (columns === 1 && rows === 1) {
    return "148mm";
  }

  if (columns <= 2 && rows <= 2) {
    return "92mm";
  }

  return "74mm";
}

function answerHeightValue(answerStyle: AnswerStyle) {
  return answerStyle === "small-kid" ? "7mm" : "13mm";
}

function sanitizeFilename(value: string) {
  return `${value || "chess-homework"}`
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function applyPrintSaverPattern(
  container: HTMLElement | null,
  patternId: string,
) {
  const svg = container?.querySelector("svg");

  if (!svg) {
    return;
  }

  const namespace = "http://www.w3.org/2000/svg";
  let defs = svg.querySelector("defs");

  if (!defs) {
    defs = document.createElementNS(namespace, "defs");
    svg.insertBefore(defs, svg.firstChild);
  }

  if (!defs.querySelector(`#${patternId}`)) {
    const pattern = document.createElementNS(namespace, "pattern");
    pattern.setAttribute("id", patternId);
    pattern.setAttribute("patternUnits", "userSpaceOnUse");
    pattern.setAttribute("width", "12");
    pattern.setAttribute("height", "12");

    const image = document.createElementNS(namespace, "image");
    image.setAttribute("href", "/patterns/dark-square-slash.png");
    image.setAttribute("width", "12");
    image.setAttribute("height", "12");
    image.setAttribute("preserveAspectRatio", "none");

    pattern.appendChild(image);
    defs.appendChild(pattern);
  }

  svg
    .querySelectorAll<SVGRectElement>(".board .square.black")
    .forEach((square) => {
      square.style.fill = `url(#${patternId})`;
    });
}

function ChessDiagram({
  boardTheme,
  fen,
  pieceTheme,
  sideToMove,
}: {
  boardTheme: BoardTheme;
  fen: string;
  pieceTheme: PieceTheme;
  sideToMove: SideToMove;
}) {
  const boardElement = useRef<HTMLDivElement | null>(null);
  const patternId = `print-saver-dark-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    if (!boardElement.current) {
      return;
    }

    const board = new Chessboard(boardElement.current, {
      position: fen || FEN.empty,
      orientation: sideToMove === "Black" ? COLOR.black : COLOR.white,
      responsive: true,
      assetsUrl: "/cm-chessboard/assets/",
      assetsCache: false,
      style: {
        cssClass: `print-saver ${boardThemeClassNames[boardTheme]}`,
        pieces: {
          file: pieceThemeFiles[pieceTheme],
        },
        showCoordinates: true,
        borderType: BORDER_TYPE.frame,
        animationDuration: 0,
      },
    });

    if (boardTheme === "print") {
      window.requestAnimationFrame(() =>
        applyPrintSaverPattern(boardElement.current, patternId),
      );
    }

    return () => {
      board.destroy();
    };
  }, [boardTheme, fen, patternId, pieceTheme, sideToMove]);

  return (
    <div
      className="chess-diagram"
      ref={boardElement}
      aria-label={`${sideToMove} to move chess position`}
    />
  );
}

function AnswerBox({
  answerStyle,
  language,
  sideToMove,
}: {
  answerStyle: AnswerStyle;
  language: Language;
  sideToMove: SideToMove;
}) {
  const t = translations[language];

  if (answerStyle === "small-kid") {
    return (
      <p className="answer-zone answer-zone-small-kid">
        {t.sideToMove}: {sideLabel(sideToMove, language)}
      </p>
    );
  }

  return (
    <div className="answer-zone">
      <div className="side-box">
        <span>{t.sideToMove}</span>
        <strong>{sideLabel(sideToMove, language)}</strong>
      </div>
      <div className="notation-box">
        <span>{t.answerNotation}</span>
      </div>
    </div>
  );
}

function CoverPage({
  className,
  coverStyle,
  difficultyStyle,
  instructions,
  language,
  puzzleCount,
  showLogos,
  worksheetPageCount,
  title,
  worksheetDate,
}: {
  className: string;
  coverStyle: CoverStyle;
  difficultyStyle: DifficultyStyle;
  instructions: string;
  language: Language;
  puzzleCount: number;
  showLogos: boolean;
  worksheetPageCount: number;
  title: string;
  worksheetDate: string;
}) {
  const difficulty =
    difficultyOptions.find((option) => option.value === difficultyStyle) ??
    difficultyOptions[0];
  const t = translations[language];

  return (
    <section
      className={`cover-page cover-${coverStyle} difficulty-${difficulty.value}`}
    >
      {showLogos && (
        <img className="cover-logo" src={brandLogoPath} alt="Co Vua Thay An" />
      )}
      <img
        className="cover-piece-art"
        src={difficulty.src}
        alt=""
        aria-hidden="true"
      />
      <div className="cover-copy">
        <p className="worksheet-label">{t.chessHomeworkPack}</p>
        <h2>{title || "Chess Tactics Homework"}</h2>
        <p>{instructions}</p>
      </div>
      <dl className="cover-meta">
        <div>
          <dt>{t.class}</dt>
          <dd>{className || "\u00a0"}</dd>
        </div>
        <div>
          <dt>{t.date}</dt>
          <dd>{worksheetDate || "\u00a0"}</dd>
        </div>
        <div>
          <dt>{t.level}</dt>
          <dd>{difficultyLabel(difficulty.value, language).piece}</dd>
        </div>
        <div>
          <dt>{t.puzzlesPages}</dt>
          <dd>
            {puzzleCount} / {worksheetPageCount}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function App() {
  const bundledPuzzles = useMemo(
    () => parsePuzzlePack(firstPuzzlePackPgn, "first-pack"),
    [],
  );
  const searchParams = new URLSearchParams(window.location.search);
  const isExportRoute = searchParams.get("export") === "pdf";
  const exportStateId = searchParams.get("stateId");
  const [title, setTitle] = useState("Capture The Defender");
  const [studentName, setStudentName] = useState("");
  const [className, setClassName] = useState("");
  const [worksheetDate, setWorksheetDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [instructions, setInstructions] = useState(defaultInstructions("en"));
  const [fontFamily, setFontFamily] = useState(fontOptions[0].value);
  const [fontSize, setFontSize] = useState(14);
  const [includeCover, setIncludeCover] = useState(true);
  const [coverStyle, setCoverStyle] = useState<CoverStyle>("academy");
  const [difficultyStyle, setDifficultyStyle] =
    useState<DifficultyStyle>("pawn");
  const [answerStyle, setAnswerStyle] = useState<AnswerStyle>("standard");
  const [boardTheme, setBoardTheme] = useState<BoardTheme>("print");
  const [pieceTheme, setPieceTheme] = useState<PieceTheme>("standard");
  const [showLogos, setShowLogos] = useState(true);
  const [showPuzzlePrompts, setShowPuzzlePrompts] = useState(false);
  const [gridColumns, setGridColumns] = useState(3);
  const [gridRows, setGridRows] = useState(3);
  const [puzzlePool, setPuzzlePool] = useState<Puzzle[]>(bundledPuzzles);
  const [puzzleSourceName, setPuzzleSourceName] = useState(
    "Capture The Defender",
  );
  const [bookPageTarget, setBookPageTarget] = useState(1);
  const [selectedPuzzleIds, setSelectedPuzzleIds] = useState<string[]>(() =>
    bundledPuzzles.slice(0, 9).map((puzzle) => puzzle.id),
  );
  const [promptEdits, setPromptEdits] = useState<Record<string, string>>({});
  const [pgnText, setPgnText] = useState("");
  const [importMessage, setImportMessage] = useState(bundledPackMessage("en"));
  const [isImageExporting, setIsImageExporting] = useState(false);
  const [exportStateLoaded, setExportStateLoaded] = useState(!exportStateId);
  const [language, setLanguage] = useState<Language>("en");
  const puzzlesPerPage = gridColumns * gridRows;
  const t = translations[language];

  const puzzles = selectedPuzzleIds
    .map((id) => puzzlePool.find((puzzle) => puzzle.id === id))
    .filter((puzzle): puzzle is Puzzle => puzzle !== undefined)
    .map((puzzle) => ({
      ...puzzle,
      prompt: promptEdits[puzzle.id] ?? puzzle.prompt,
    }));
  const worksheetPages = chunkPuzzles(puzzles, puzzlesPerPage);
  const maxAvailablePages = Math.min(
    MAX_BOOK_PAGES,
    Math.max(1, Math.ceil(puzzlePool.length / puzzlesPerPage)),
  );

  const updatePrompt = (id: string, prompt: string) => {
    setPromptEdits((current) => ({ ...current, [id]: prompt }));
  };

  const updateLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    setInstructions((current) => {
      if (
        current === defaultInstructions("en") ||
        current === defaultInstructions("vi")
      ) {
        return defaultInstructions(nextLanguage);
      }

      return current;
    });
    setImportMessage((current) => {
      if (
        current === bundledPackMessage("en") ||
        current === bundledPackMessage("vi")
      ) {
        return bundledPackMessage(nextLanguage);
      }

      return current;
    });
  };

  const selectFirstPages = (
    pageCount = bookPageTarget,
    nextPool = puzzlePool,
  ) => {
    const safePageCount = Math.min(
      MAX_BOOK_PAGES,
      Math.max(1, Math.floor(pageCount)),
    );
    const puzzleCount = safePageCount * puzzlesPerPage;
    setSelectedPuzzleIds(
      nextPool.slice(0, puzzleCount).map((puzzle) => puzzle.id),
    );
    setPromptEdits({});
  };

  const loadFirstPack = () => {
    setPuzzlePool(bundledPuzzles);
    setPuzzleSourceName("Capture The Defender");
    setTitle("Capture The Defender");
    setBookPageTarget(1);
    selectFirstPages(1, bundledPuzzles);
    setImportMessage(bundledPackMessage(language));
  };

  const importPgn = (pgn: string, sourceName = "Imported PGN") => {
    const imported = parsePuzzlePack(pgn, `import-${Date.now()}`);

    if (imported.length === 0) {
      setImportMessage(t.noValidFen);
      return;
    }

    setPuzzlePool(imported);
    setPuzzleSourceName(sourceName);
    setTitle(
      sourceName.replace(/\.[^.]+$/, "") ||
        (language === "vi"
          ? "Bài tập cờ vua đã nhập"
          : "Imported Chess Homework"),
    );
    setSelectedPuzzleIds(imported.slice(0, 9).map((puzzle) => puzzle.id));
    setBookPageTarget(1);
    setPromptEdits({});
    setImportMessage(t.puzzlesImported(imported.length));
  };

  const togglePuzzleSelection = (puzzleId: string) => {
    setSelectedPuzzleIds((current) => {
      if (current.includes(puzzleId)) {
        return current.filter((id) => id !== puzzleId);
      }

      return [...current, puzzleId];
    });
  };

  const handleFileImport = async (file: File | null) => {
    if (!file) {
      return;
    }

    const text = await file.text();
    setPgnText(text);
    importPgn(text, file.name);
  };

  const buildExportState = (): ExportWorksheetState => ({
    answerStyle,
    boardTheme,
    className,
    coverStyle,
    difficultyStyle,
    fontFamily,
    fontSize,
    includeCover,
    instructions,
    language,
    puzzles,
    showPuzzlePrompts,
    gridColumns,
    gridRows,
    pieceTheme,
    showLogos,
    studentName,
    title,
    worksheetDate,
  });

  const applyExportState = (state: ExportWorksheetState) => {
    setTitle(state.title);
    setStudentName(state.studentName);
    setClassName(state.className);
    setWorksheetDate(state.worksheetDate);
    setInstructions(state.instructions);
    setLanguage(state.language ?? "en");
    setFontFamily(state.fontFamily);
    setFontSize(state.fontSize);
    setIncludeCover(state.includeCover);
    setCoverStyle(state.coverStyle);
    setDifficultyStyle(state.difficultyStyle);
    setAnswerStyle(state.answerStyle ?? "standard");
    setBoardTheme(state.boardTheme ?? "print");
    setPieceTheme(state.pieceTheme ?? "standard");
    setShowLogos(state.showLogos ?? true);
    setShowPuzzlePrompts(state.showPuzzlePrompts);
    setGridColumns(state.gridColumns);
    setGridRows(state.gridRows);
    setPuzzlePool(state.puzzles);
    setSelectedPuzzleIds(state.puzzles.map((puzzle) => puzzle.id));
    setPromptEdits({});
  };

  const exportImagePdf = async () => {
    setIsImageExporting(true);

    try {
      const { exportPrintDocumentToImagePdf } = await import(
        "./export/clientImagePdf"
      );

      await exportPrintDocumentToImagePdf({
        filename: `${sanitizeFilename(title)}-image.pdf`,
        state: buildExportState(),
      });
    } catch (error) {
      setImportMessage(
        error instanceof Error ? error.message : t.imagePdfFailed,
      );
    } finally {
      setIsImageExporting(false);
    }
  };

  useEffect(() => {
    if (!exportStateId) {
      return;
    }

    window.__WORKSHEET_EXPORT_READY = false;

    fetch(`/api/export-state/${encodeURIComponent(exportStateId)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Export state not found.");
        }

        return response.json() as Promise<ExportWorksheetState>;
      })
      .then((state) => {
        applyExportState(state);
        setExportStateLoaded(true);
      })
      .catch(() => {
        setExportStateLoaded(true);
      });
  }, [exportStateId]);

  useEffect(() => {
    if (!isExportRoute || !exportStateLoaded) {
      return;
    }

    window.__WORKSHEET_EXPORT_READY = false;
    const readyTimer = window.setTimeout(() => {
      window.__WORKSHEET_EXPORT_READY = true;
    }, 600);

    return () => window.clearTimeout(readyTimer);
  }, [
    answerStyle,
    boardTheme,
    className,
    coverStyle,
    difficultyStyle,
    exportStateLoaded,
    fontFamily,
    fontSize,
    gridColumns,
    gridRows,
    includeCover,
    instructions,
    isExportRoute,
    language,
    pieceTheme,
    puzzles.length,
    showLogos,
    showPuzzlePrompts,
    studentName,
    title,
    worksheetDate,
  ]);

  if (isExportRoute && !exportStateLoaded) {
    return <main className="app-shell export-shell" />;
  }

  return (
    <main className={isExportRoute ? "app-shell export-shell" : "app-shell"}>
      <aside className="editor-panel no-print" aria-label="Worksheet settings">
        <div className="panel-intro">
          <p className="eyebrow">{t.phase}</p>
          <h1>{t.worksheetBuilder}</h1>
          <p className="panel-copy">{t.panelCopy}</p>
        </div>

        <div className="language-toggle" aria-label={t.language}>
          <span>{t.language}</span>
          <div>
            <button
              type="button"
              className={language === "en" ? "active" : ""}
              onClick={() => updateLanguage("en")}
            >
              EN
            </button>
            <button
              type="button"
              className={language === "vi" ? "active" : ""}
              onClick={() => updateLanguage("vi")}
            >
              VI
            </button>
          </div>
        </div>

        <div className="editor-stack">
          <section className="editor-section editor-section-load">
            <div className="section-heading">
              <p className="section-kicker">{t.sectionLoad}</p>
              <h2>{t.firstPuzzlePack}</h2>
            </div>

            <div className="pack-card">
              <span>{t.firstPuzzlePack}</span>
              <strong>Capture The Defender</strong>
              <p>{t.firstPuzzlePackInfo(bundledPuzzles.length)}</p>
              <button type="button" onClick={loadFirstPack}>
                {t.loadFirstPage}
              </button>
            </div>

            <div className="control-group">
              <label>
                {t.uploadPgnPuzzlePack}
                <input
                  accept=".pgn,.txt"
                  type="file"
                  onChange={(event) =>
                    void handleFileImport(event.target.files?.[0] ?? null)
                  }
                />
              </label>
              <label>
                {t.pastePgn}
                <textarea
                  rows={5}
                  placeholder={t.pastePgnPlaceholder}
                  value={pgnText}
                  onChange={(event) => setPgnText(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="secondary-button"
                onClick={() => importPgn(pgnText)}
              >
                {t.importPastedPgn}
              </button>
              <p className="import-message">{importMessage}</p>
            </div>

            <div className="puzzle-picker" aria-label="Puzzle selection">
              <div className="picker-header">
                <span>{puzzleSourceName}</span>
                <strong>
                  {selectedPuzzleIds.length} {t.selected}
                </strong>
              </div>
              <div className="book-builder">
                <label>
                  {t.bookPages}
                  <input
                    min="1"
                    max={maxAvailablePages}
                    type="number"
                    value={bookPageTarget}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      setBookPageTarget(
                        Math.min(maxAvailablePages, Math.max(1, nextValue)),
                      );
                    }}
                  />
                </label>
                <button type="button" onClick={() => selectFirstPages()}>
                  {t.buildFirstPage(bookPageTarget)}
                </button>
              </div>
              <div className="picker-actions">
                <button type="button" onClick={() => selectFirstPages(1)}>
                  {t.selectFirstPage}
                </button>
                <button type="button" onClick={() => setSelectedPuzzleIds([])}>
                  {t.clear}
                </button>
              </div>
              <div className="puzzle-list">
                {puzzlePool.slice(0, 60).map((puzzle) => (
                  <label className="puzzle-option" key={puzzle.id}>
                    <input
                      checked={selectedPuzzleIds.includes(puzzle.id)}
                      type="checkbox"
                      onChange={() => togglePuzzleSelection(puzzle.id)}
                    />
                    <span>#{puzzle.number}</span>
                    <strong>{sideLabel(puzzle.sideToMove, language)}</strong>
                    <em>
                      {puzzle.rating
                        ? `${t.rating} ${puzzle.rating}`
                        : t.noRating}
                    </em>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="editor-section editor-section-theme">
            <div className="section-heading">
              <p className="section-kicker">{t.sectionTheme}</p>
              <h2>{t.boardTheme}</h2>
            </div>

            <div className="control-grid">
              <label>
                {t.answerStyle}
                <select
                  value={answerStyle}
                  onChange={(event) =>
                    setAnswerStyle(event.target.value as AnswerStyle)
                  }
                >
                  {answerStyleOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.labels[language]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.boardTheme}
                <select
                  value={boardTheme}
                  onChange={(event) =>
                    setBoardTheme(event.target.value as BoardTheme)
                  }
                >
                  {boardThemeOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.labels[language]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.pieceSet}
                <select
                  value={pieceTheme}
                  onChange={(event) =>
                    setPieceTheme(event.target.value as PieceTheme)
                  }
                >
                  {pieceThemeOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.labels[language]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="control-grid">
              <label>
                {t.font}
                <select
                  value={fontFamily}
                  onChange={(event) => setFontFamily(event.target.value)}
                >
                  {fontOptions.map((font) => (
                    <option value={font.value} key={font.label}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.size}
                <input
                  min="11"
                  max="18"
                  type="number"
                  value={fontSize}
                  onChange={(event) => setFontSize(Number(event.target.value))}
                />
              </label>
            </div>

            <div className="control-group">
              <label className="checkbox-label">
                <input
                  checked={showLogos}
                  type="checkbox"
                  onChange={(event) => setShowLogos(event.target.checked)}
                />
                {t.showLogos}
              </label>
              <label className="checkbox-label">
                <input
                  checked={includeCover}
                  type="checkbox"
                  onChange={(event) => setIncludeCover(event.target.checked)}
                />
                {t.includeCoverPage}
              </label>
              <div className="control-grid">
                <label>
                  {t.coverDesign}
                  <select
                    disabled={!includeCover}
                    value={coverStyle}
                    onChange={(event) =>
                      setCoverStyle(event.target.value as CoverStyle)
                    }
                  >
                    {coverOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {coverStyleLabel(option.value, language)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.difficultyArt}
                  <select
                    disabled={!includeCover}
                    value={difficultyStyle}
                    onChange={(event) =>
                      setDifficultyStyle(event.target.value as DifficultyStyle)
                    }
                  >
                    {difficultyOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {difficultyLabel(option.value, language).option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section className="editor-section editor-section-worksheet">
            <div className="section-heading">
              <p className="section-kicker">{t.sectionWorksheet}</p>
              <h2>{t.worksheetTitle}</h2>
            </div>

            <div className="control-group">
              <label>
                {t.worksheetTitle}
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label>
                {t.instructions}
                <textarea
                  rows={4}
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                />
              </label>
            </div>

            <div className="control-grid">
              <label>
                {t.student}
                <input
                  placeholder={t.leaveBlankForStudents}
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                />
              </label>
              <label>
                {t.class}
                <input
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                />
              </label>
              <label>
                {t.date}
                <input
                  type="date"
                  value={worksheetDate}
                  onChange={(event) => setWorksheetDate(event.target.value)}
                />
              </label>
            </div>

            <div className="control-group">
              <label className="checkbox-label">
                <input
                  checked={showPuzzlePrompts}
                  type="checkbox"
                  onChange={(event) => setShowPuzzlePrompts(event.target.checked)}
                />
                {t.showPuzzlePromptText}
              </label>
              <div className="control-grid">
                <label>
                  {t.columns}
                  <input
                    min="1"
                    max="5"
                    type="number"
                    value={gridColumns}
                    onChange={(event) =>
                      setGridColumns(clampNumber(Number(event.target.value), 1, 5))
                    }
                  />
                </label>
                <label>
                  {t.rows}
                  <input
                    min="1"
                    max="6"
                    type="number"
                    value={gridRows}
                    onChange={(event) =>
                      setGridRows(clampNumber(Number(event.target.value), 1, 6))
                    }
                  />
                </label>
              </div>
              <p className="import-message">{t.puzzlesPerPage(puzzlesPerPage)}</p>
            </div>
          </section>

          <section className="editor-section editor-section-export">
            <div className="section-heading">
              <p className="section-kicker">{t.sectionExport}</p>
              <h2>{t.exportImagePdf}</h2>
            </div>

            <div className="export-actions">
              <button
                type="button"
                className="image-export-button"
                disabled={isImageExporting}
                onClick={() => void exportImagePdf()}
              >
                {isImageExporting ? t.exportingImagePdf : t.exportImagePdf}
              </button>
            </div>
          </section>
        </div>
      </aside>

      <section className="preview-area" aria-label="Worksheet preview">
        <div
          className="print-document"
          style={
            {
              "--answer-height": answerHeightValue(answerStyle),
              "--board-max-size": boardMaxSizeValue(gridColumns, gridRows),
              "--grid-columns": gridColumns,
              "--grid-rows": gridRows,
              "--worksheet-font": fontFamily,
              "--worksheet-size": `${fontSize}px`,
            } as React.CSSProperties
          }
        >
          {includeCover && (
            <CoverPage
              className={className}
              coverStyle={coverStyle}
              difficultyStyle={difficultyStyle}
              instructions={instructions}
              language={language}
              puzzleCount={puzzles.length}
              showLogos={showLogos}
              worksheetPageCount={worksheetPages.length}
              title={title}
              worksheetDate={worksheetDate}
            />
          )}

          {worksheetPages.length === 0 ? (
            <div className="worksheet empty-worksheet">
              <p>{t.noPuzzlesSelected}</p>
            </div>
          ) : (
            worksheetPages.map((pagePuzzles, pageIndex) => (
              <div
                className={
                  pageIndex === worksheetPages.length - 1
                    ? "worksheet last-worksheet"
                    : "worksheet"
                }
                key={`worksheet-page-${pageIndex + 1}`}
              >
                <header className="worksheet-header">
                  <div>
                    <div className="worksheet-brand-line">
                      <p className="worksheet-label">
                        {t.chessHomework} · {t.page} {pageIndex + 1} /{" "}
                        {worksheetPages.length}
                      </p>
                      {showLogos && (
                        <img
                          className="page-logo"
                          src={brandLogoPath}
                          alt="Co Vua Thay An"
                        />
                      )}
                    </div>
                    <h2>{title || t.titleFallback}</h2>
                    <p className="instructions">{instructions}</p>
                  </div>
                  <dl className="student-meta">
                    <div>
                      <dt>{t.student}</dt>
                      <dd>{studentName || "\u00a0"}</dd>
                    </div>
                    <div>
                      <dt>{t.class}</dt>
                      <dd>{className || "\u00a0"}</dd>
                    </div>
                    <div>
                      <dt>{t.date}</dt>
                      <dd>{worksheetDate || "\u00a0"}</dd>
                    </div>
                  </dl>
                </header>

                <div className="puzzle-grid">
                  {pagePuzzles.map((puzzle, puzzleIndex) => {
                    const globalIndex =
                      pageIndex * puzzlesPerPage + puzzleIndex;

                    return (
                      <article
                        className={
                          `${showPuzzlePrompts ? "puzzle-card has-prompt" : "puzzle-card compact-puzzle"}${answerStyle === "small-kid" ? " answer-small-kid" : ""}`
                        }
                        key={puzzle.id}
                      >
                        {showPuzzlePrompts && (
                          <>
                            <textarea
                              id={`prompt-${puzzle.id}`}
                              className="prompt-editor"
                              value={localizePrompt(puzzle, language)}
                              onChange={(event) =>
                                updatePrompt(puzzle.id, event.target.value)
                              }
                            />
                            <p className="prompt-print">
                              {localizePrompt(puzzle, language)}
                            </p>
                          </>
                        )}
                        {!showPuzzlePrompts && (
                          <p className="puzzle-number">#{globalIndex + 1}</p>
                        )}
                        <div className="board-slot">
                          <ChessDiagram
                            boardTheme={boardTheme}
                            fen={puzzle.fen}
                            pieceTheme={pieceTheme}
                            sideToMove={puzzle.sideToMove}
                          />
                        </div>
                        <AnswerBox
                          answerStyle={answerStyle}
                          language={language}
                          sideToMove={puzzle.sideToMove}
                        />
                      </article>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
