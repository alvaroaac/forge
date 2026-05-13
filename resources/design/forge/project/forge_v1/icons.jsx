// Lightweight inline icon set — stroke-only, terminal-ish
const Icon = ({ children, size = 14, stroke = 1.5, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
       stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
       strokeLinejoin="round" style={style} aria-hidden="true">
    {children}
  </svg>
);

const IconSettings = (p) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="2" />
    <path d="M8 1.5v1.8M8 12.7v1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M1.5 8h1.8M12.7 8h1.8M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3" />
  </Icon>
);
const IconClose = (p) => (
  <Icon {...p}><path d="M3 3l10 10M13 3L3 13" /></Icon>
);
const IconChevronRight = (p) => (
  <Icon {...p}><path d="M6 3l5 5-5 5" /></Icon>
);
const IconChevronDown = (p) => (
  <Icon {...p}><path d="M3 6l5 5 5-5" /></Icon>
);
const IconExternal = (p) => (
  <Icon {...p}><path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9" /></Icon>
);
const IconPlus = (p) => (
  <Icon {...p}><path d="M8 3v10M3 8h10" /></Icon>
);
const IconRefresh = (p) => (
  <Icon {...p}><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 3v3h-3" /></Icon>
);
const IconCheck = (p) => (
  <Icon {...p}><path d="M3 8.5l3.2 3L13 4.5" /></Icon>
);
const IconEdit = (p) => (
  <Icon {...p}><path d="M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z" /></Icon>
);
const IconSpark = (p) => (
  <Icon {...p}><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" /></Icon>
);
const IconTerminal = (p) => (
  <Icon {...p}><path d="M2 3h12v10H2zM4.5 6.5l2 1.5-2 1.5M8 10h3.5" /></Icon>
);
const IconBolt = (p) => (
  <Icon {...p}><path d="M9 1.5L3 9h4l-1 5.5L13 7H9l0-5.5z" /></Icon>
);
const IconBug = (p) => (
  <Icon {...p}>
    <path d="M5 5.5a3 3 0 0 1 6 0v2a3 3 0 0 1-6 0z" />
    <path d="M3 7h2M11 7h2M3.5 4l1.7 1.3M12.5 4l-1.7 1.3M3.5 10l1.7-1.3M12.5 10l-1.7-1.3M8 9.5v4M5.5 13l-1.5 1M10.5 13l1.5 1" />
  </Icon>
);
const IconFlame = (p) => (
  <Icon {...p}><path d="M8 14c-2.8 0-4.5-2-4.5-4.3 0-2.5 2-3.7 2.5-5.7C7 5.5 8 6 8.5 7.5 9.5 5 11 4 11 2c2 2.5 1.5 5.5.5 7 .8.4 1 1.5 1 2.5 0 1.7-1.5 2.5-2.5 2.5" /></Icon>
);
const IconArrowUp = (p) => (
  <Icon {...p}><path d="M8 13V3M4 7l4-4 4 4" /></Icon>
);
const IconMinus = (p) => (
  <Icon {...p}><path d="M3 8h10" /></Icon>
);
const IconArrowDown = (p) => (
  <Icon {...p}><path d="M8 3v10M12 9l-4 4-4-4" /></Icon>
);
const IconBranch = (p) => (
  <Icon {...p}>
    <circle cx="4" cy="3.5" r="1.3" />
    <circle cx="4" cy="12.5" r="1.3" />
    <circle cx="12" cy="6" r="1.3" />
    <path d="M4 4.8v6.4M4 9c0-3 8-1.5 8-4.5" />
  </Icon>
);
const IconFolder = (p) => (
  <Icon {...p}>
    <path d="M2 4.5h4l1.2 1.5H14v7H2z" />
  </Icon>
);
const IconCpu = (p) => (
  <Icon {...p}>
    <rect x="4" y="4" width="8" height="8" rx="1" />
    <path d="M6.5 6.5h3v3h-3zM2 6.5h2M2 9.5h2M12 6.5h2M12 9.5h2M6.5 2v2M9.5 2v2M6.5 12v2M9.5 12v2" />
  </Icon>
);
const IconSearch = (p) => (
  <Icon {...p}><circle cx="7" cy="7" r="4" /><path d="M10 10l3.5 3.5" /></Icon>
);
const IconDashboard = (p) => (
  <Icon {...p}>
    <rect x="2.5" y="2.5" width="4.5" height="6" rx="0.5" />
    <rect x="9" y="2.5" width="4.5" height="3.5" rx="0.5" />
    <rect x="2.5" y="10.5" width="4.5" height="3" rx="0.5" />
    <rect x="9" y="8" width="4.5" height="5.5" rx="0.5" />
  </Icon>
);
const IconOrch = (p) => (
  <Icon {...p}>
    <circle cx="8" cy="3" r="1.4" />
    <circle cx="3.5" cy="12" r="1.4" />
    <circle cx="8" cy="12" r="1.4" />
    <circle cx="12.5" cy="12" r="1.4" />
    <path d="M8 4.5v3M8 7.5L3.5 10.5M8 7.5l4.5 3M8 7.5v3" />
  </Icon>
);
const IconPlug = (p) => (
  <Icon {...p}>
    <path d="M5 2v3M9 2v3M3.5 5h7v3a3.5 3.5 0 0 1-7 0z" />
    <path d="M7 11.5V14" />
  </Icon>
);
const IconBook = (p) => (
  <Icon {...p}>
    <path d="M3 3h4.5c1 0 1.5.5 1.5 1.5V14M3 3v10h4.5c1 0 1.5.5 1.5 1M13 3H8.5C7.5 3 7 3.5 7 4.5V14M13 3v10H8.5c-1 0-1.5.5-1.5 1" />
  </Icon>
);
const IconChat = (p) => (
  <Icon {...p}><path d="M2.5 3h11v7.5h-5L5 13v-2.5H2.5z" /></Icon>
);
const IconKill = (p) => (
  <Icon {...p}><rect x="4" y="4" width="8" height="8" rx="0.5" /></Icon>
);
const IconPause = (p) => (
  <Icon {...p}><path d="M5.5 3v10M10.5 3v10" /></Icon>
);
const IconPlay = (p) => (
  <Icon {...p}><path d="M4.5 3v10l8-5z" /></Icon>
);
const IconDot = (p) => (
  <Icon {...p}><circle cx="8" cy="8" r="2" /></Icon>
);
const IconCmd = (p) => (
  <Icon {...p}>
    <path d="M6 4.5a1.5 1.5 0 1 0 1.5 1.5v4A1.5 1.5 0 1 0 9 8.5h-2a1.5 1.5 0 1 0-1.5 1.5z" />
  </Icon>
);
const IconRegen = (p) => (
  <Icon {...p}>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 3v3h-3" />
    <circle cx="8" cy="8" r="1" />
  </Icon>
);
const IconClock = (p) => (
  <Icon {...p}><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 1.5" /></Icon>
);
const IconCoin = (p) => (
  <Icon {...p}>
    <ellipse cx="8" cy="5" rx="5" ry="2" />
    <path d="M3 5v6c0 1.1 2.2 2 5 2s5-.9 5-2V5" />
  </Icon>
);

Object.assign(window, {
  Icon, IconSettings, IconClose, IconChevronRight, IconChevronDown,
  IconExternal, IconPlus, IconRefresh, IconCheck, IconEdit, IconSpark,
  IconTerminal, IconBolt, IconBug, IconFlame, IconArrowUp, IconMinus, IconArrowDown,
  IconBranch, IconFolder, IconCpu,
  IconSearch, IconDashboard, IconOrch, IconPlug, IconBook, IconChat,
  IconKill, IconPause, IconPlay, IconDot, IconCmd, IconRegen, IconClock, IconCoin,
});
