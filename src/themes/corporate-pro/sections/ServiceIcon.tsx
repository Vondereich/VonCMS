import {
  Menu,
  X,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Edit2,
  Rss,
  Target,
  Cpu,
  BarChart,
  Sun,
  Moon,
  HelpCircle,
  Briefcase,
  Users,
  Shield,
  Globe,
  Award,
  Zap,
  Activity,
  ArrowRight,
  CheckCircle,
  Clock,
  type LucideIcon,
} from 'lucide-react';

export const SERVICE_ICONS: Record<string, LucideIcon> = {
  Menu,
  X,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Edit2,
  Rss,
  Target,
  Cpu,
  BarChart,
  Sun,
  Moon,
  HelpCircle,
  Briefcase,
  Users,
  Shield,
  Globe,
  Award,
  Zap,
  Activity,
  ArrowRight,
  CheckCircle,
  Clock,
};

const ServiceIcon = ({ name, size = 20 }: { name: string; size?: number }) => {
  const Icon = Object.hasOwn(SERVICE_ICONS, name) ? SERVICE_ICONS[name] : HelpCircle;
  return <Icon size={size} />;
};

export default ServiceIcon;
