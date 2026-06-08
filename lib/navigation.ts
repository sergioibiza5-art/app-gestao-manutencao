import {
  Banknote,
  Car,
  ClipboardCheck,
  FileText,
  Gauge,
  LayoutDashboard,
  Package,
  Receipt,
  Rows3,
  UserCog,
  Wrench,
} from "lucide-react";

export const navigation = [
  { name: "Dashboard", href: "/", meta: "Visao diaria", icon: LayoutDashboard, color: "bg-teal-400/15 text-teal-200" },
  { name: "Despesas", href: "/despesas", meta: "Faturas e recibos", icon: Receipt, color: "bg-amber-400/15 text-amber-200" },
  { name: "Contas", href: "/contas", meta: "Mensais e orcamento", icon: Banknote, color: "bg-emerald-400/15 text-emerald-200" },
  { name: "Tarefas", href: "/tarefas", meta: "Recorrencias", icon: ClipboardCheck, color: "bg-teal-400/15 text-teal-200" },
  { name: "Manutencao", href: "/manutencao", meta: "Ativos e infraestrutura", icon: Wrench, color: "bg-cyan-400/15 text-cyan-200" },
  { name: "Frota", href: "/frota", meta: "Veiculos e quilometros", icon: Car, color: "bg-blue-400/15 text-blue-200" },
  { name: "Calibracao", href: "/calibracao", meta: "Certificados", icon: Gauge, color: "bg-lime-400/15 text-lime-200" },
  { name: "Inventario", href: "/inventario", meta: "Stock e consumiveis", icon: Package, color: "bg-orange-400/15 text-orange-200" },
  { name: "Checklists", href: "/checklists", meta: "Modelos por tipo", icon: Rows3, color: "bg-sky-400/15 text-sky-200" },
  { name: "Documentos", href: "/documentos", meta: "Garantias e contratos", icon: FileText, color: "bg-rose-400/15 text-rose-200" },
  { name: "Acessos", href: "/acessos", meta: "Perfis e permissoes", icon: UserCog, color: "bg-violet-400/15 text-violet-200" },
];
