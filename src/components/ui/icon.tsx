import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Building03Icon,
  Call02Icon,
  Cancel01Icon,
  CancelCircleIcon,
  ChartHistogramIcon,
  CheckmarkCircle02Icon,
  CircleIcon,
  Clock01Icon,
  Copy01Icon,
  DashboardSquare01Icon,
  DatabaseSyncIcon,
  Download04Icon,
  File02Icon,
  FileAddIcon,
  FileSearchIcon,
  Files01Icon,
  FilterIcon,
  Home01Icon,
  IdeaIcon,
  IdIcon,
  InformationCircleIcon,
  Key01Icon,
  Link01Icon,
  Loading03Icon,
  LockPasswordIcon,
  Login03Icon,
  Logout01Icon,
  Mail01Icon,
  Menu01Icon,
  Moon02Icon,
  MoreHorizontalIcon,
  Mortarboard02Icon,
  Notification01Icon,
  PassportIcon,
  PrinterIcon,
  RefreshIcon,
  Search01Icon,
  SecurityCheckIcon,
  Settings02Icon,
  Shield01Icon,
  StarIcon,
  Sun03Icon,
  TaskDaily01Icon,
  Tick02Icon,
  Upload04Icon,
  UserCircleIcon,
  UserGroupIcon,
  UserIcon,
  UserMultipleIcon,
  ViewIcon,
  ViewOffSlashIcon,
  WorkHistoryIcon,
} from "@hugeicons/core-free-icons";

// ชื่อไอคอนเชิงความหมาย → ค่าคงที่ของ Hugeicons (Stroke Rounded) ตาม Design System
const icons = {
  alert: Alert02Icon,
  arrowLeft: ArrowLeft01Icon,
  bell: Notification01Icon,
  building: Building03Icon,
  bulb: IdeaIcon,
  chart: ChartHistogramIcon,
  check: Tick02Icon,
  checkCircle: CheckmarkCircle02Icon,
  chevronDown: ArrowDown01Icon,
  chevronRight: ArrowRight01Icon,
  circle: CircleIcon,
  clock: Clock01Icon,
  close: Cancel01Icon,
  copy: Copy01Icon,
  dashboard: DashboardSquare01Icon,
  doc: File02Icon,
  download: Download04Icon,
  eye: ViewIcon,
  eyeOff: ViewOffSlashIcon,
  fileAdd: FileAddIcon,
  fileSearch: FileSearchIcon,
  files: Files01Icon,
  filter: FilterIcon,
  graduation: Mortarboard02Icon,
  history: WorkHistoryIcon,
  home: Home01Icon,
  idCard: IdIcon,
  info: InformationCircleIcon,
  key: Key01Icon,
  link: Link01Icon,
  loading: Loading03Icon,
  lock: LockPasswordIcon,
  login: Login03Icon,
  logout: Logout01Icon,
  mail: Mail01Icon,
  menu: Menu01Icon,
  moon: Moon02Icon,
  more: MoreHorizontalIcon,
  passport: PassportIcon,
  phone: Call02Icon,
  print: PrinterIcon,
  queue: TaskDaily01Icon,
  refresh: RefreshIcon,
  search: Search01Icon,
  settings: Settings02Icon,
  shield: Shield01Icon,
  shieldCheck: SecurityCheckIcon,
  star: StarIcon,
  sun: Sun03Icon,
  sync: DatabaseSyncIcon,
  upload: Upload04Icon,
  user: UserIcon,
  userCircle: UserCircleIcon,
  userGroup: UserGroupIcon,
  users: UserMultipleIcon,
  xCircle: CancelCircleIcon,
} as const;

export type IconName = keyof typeof icons;

type IconProps = {
  name: IconName;
  size?: 12 | 14 | 16 | 18 | 20 | 22 | 24 | 28 | 32 | 34;
  strokeWidth?: number;
  className?: string;
  "aria-label"?: string;
};

export function Icon({ name, size = 20, strokeWidth = 1.5, className, ...rest }: IconProps) {
  const label = rest["aria-label"];
  return (
    <HugeiconsIcon
      icon={icons[name]}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
