type P = { size?: number };
const svg = (size: number, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

export const PlayIcon = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);
export const StopIcon = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="5.5" y="5.5" width="13" height="13" rx="2" />
  </svg>
);
export const LoopIcon = ({ size = 16 }: P) => svg(size, <><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>);
export const UndoIcon = ({ size = 16 }: P) => svg(size, <><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>);
export const RedoIcon = ({ size = 16 }: P) => svg(size, <><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h3" /></>);
export const PlusIcon = ({ size = 16 }: P) => svg(size, <><path d="M12 5v14" /><path d="M5 12h14" /></>);
export const TrashIcon = ({ size = 14 }: P) => svg(size, <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></>);
export const CopyIcon = ({ size = 14 }: P) => svg(size, <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>);
export const DownloadIcon = ({ size = 14 }: P) => svg(size, <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></>);
export const FolderIcon = ({ size = 14 }: P) => svg(size, <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />);
export const UpIcon = ({ size = 12 }: P) => svg(size, <path d="M6 15l6-6 6 6" />);
export const DownIcon = ({ size = 12 }: P) => svg(size, <path d="M6 9l6 6 6-6" />);
export const UploadIcon = ({ size = 14 }: P) => svg(size, <><path d="M12 21V9" /><path d="M7 14l5-5 5 5" /><path d="M5 3h14" /></>);
export const MetroIcon = ({ size = 14 }: P) => svg(size, <><path d="M7 21L10 3h4l3 18z" /><path d="M12 15l6-8" /></>);
export const MoonIcon = ({ size = 15 }: P) => svg(size, <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />);
export const SunIcon = ({ size = 15 }: P) => svg(size, <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const SparkIcon = ({ size = 15 }: P) => svg(size, <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />);
