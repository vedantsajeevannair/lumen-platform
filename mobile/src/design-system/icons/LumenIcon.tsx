// ============================================================
// LUMEN Design System — Unified Icon System (Lucide)
// ============================================================

import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Battery,
  Bell,
  Bookmark,
  Bot,
  BrainCircuit,
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Clipboard,
  ClipboardList,
  // Domain — Status
  Clock,
  Compass,
  // Domain — AI & Analytics
  Cpu,
  Download,
  Droplets,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Fingerprint,
  // Domain — Reports & Issues
  Flag,
  Flame,
  Globe,
  HardHat,
  Heart,
  HelpCircle,
  // Navigation & UI
  Home,
  // Domain — Media
  Image as ImageIcon,
  Info,
  Landmark,
  Lightbulb,
  LineChart,
  Link,
  LocateFixed,
  Lock,
  // Profile & Auth
  LogOut,
  Mail,
  Map,
  // Domain — Maps & Location
  MapPin,
  Menu,
  // Domain — Communication
  MessageSquare,
  Moon,
  MoreHorizontal,
  MoreVertical,
  Navigation,
  Navigation2,
  Package,
  Paperclip,
  Phone,
  PieChart,
  Plus,
  RefreshCw,
  RotateCcw,
  Route,
  Search,
  Settings,
  Share2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  // Misc
  Star,
  Sun,
  Timer,
  Trash2,
  TrendingUp,
  Truck,
  Upload,
  User,
  WifiOff,
  // Domain — Engineer
  Wrench,
  X,
  XCircle,
  Zap,
} from "lucide-react-native";
import React from "react";

// Domain-specific icon aliases for LUMEN
const LUMEN_ICONS = {
  // Navigation
  home: Home,
  notifications: Bell,
  settings: Settings,
  profile: User,
  search: Search,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  close: X,
  add: Plus,
  check: Check,
  menu: Menu,
  filter: Filter,
  sliders: SlidersHorizontal,
  back: ArrowLeft,
  arrowLeft: ArrowLeft,
  forward: ArrowRight,
  moreVertical: MoreVertical,
  moreHorizontal: MoreHorizontal,

  // Reports
  report: Flag,
  reportList: ClipboardList,
  reportDetails: FileText,
  clipboard: Clipboard,

  // Infrastructure Issues
  road: MapPin,
  electricity: Zap,
  water: Droplets,
  fire: Flame,
  streetlight: Lightbulb,
  garbage: Trash2,
  bridge: Landmark,
  building: Building2,
  emergency: AlertOctagon,
  other: Package,

  // Engineer
  engineer: HardHat,
  tools: Wrench,
  vehicle: Truck,
  camera: Camera,
  upload: Upload,
  taskCheck: CheckSquare,
  timer: Timer,

  // Analytics
  analytics: BarChart3,
  trend: TrendingUp,
  activity: Activity,
  pie: PieChart,
  line: LineChart,

  // Maps
  mapPin: MapPin,
  map: Map,
  navigate: Navigation,
  navigate2: Navigation2,
  compass: Compass,
  locate: LocateFixed,
  route: Route,

  // Communication
  comment: MessageSquare,
  phone: Phone,
  email: Mail,
  share: Share2,

  // AI
  ai: BrainCircuit,
  robot: Bot,
  cpu: Cpu,
  spark: Sparkles,

  // Media
  image: ImageIcon,
  attachment: Paperclip,
  link: Link,

  // Status
  clock: Clock,
  calendar: Calendar,
  refresh: RefreshCw,
  reset: RotateCcw,
  success: CheckCircle2,
  checkCircle: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
  help: HelpCircle,
  circle: Circle,

  // Auth & Profile
  logout: LogOut,
  shield: Shield,
  lock: Lock,
  eye: Eye,
  eyeOff: EyeOff,
  biometric: Fingerprint,

  // Misc
  star: Star,
  heart: Heart,
  bookmark: Bookmark,
  download: Download,
  external: ExternalLink,
  globe: Globe,
  sun: Sun,
  moon: Moon,
  offline: WifiOff,
  battery: Battery,
  trash: Trash2,

  // Alerts
  alert: AlertTriangle,
} as const;

export type LumenIconName = keyof typeof LUMEN_ICONS;

export interface LumenIconProps {
  name: LumenIconName;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | number;
  color?: string;
  strokeWidth?: number;
}

const SIZES: Record<string, number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  "2xl": 40,
};

export function LumenIcon({
  name,
  size = "md",
  color = "#101828",
  strokeWidth = 2,
}: LumenIconProps) {
  const IconComponent = LUMEN_ICONS[name];
  const resolvedSize = typeof size === "number" ? size : (SIZES[size] ?? 20);

  if (!IconComponent) return null;
  return <IconComponent size={resolvedSize} color={color} strokeWidth={strokeWidth} />;
}
