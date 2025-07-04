import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  FileDown, 
  FileText, 
  FileSpreadsheet,
  Calendar as CalendarIcon,
  Filter,
  BarChart3,
  Download,
  Clock,
  CheckCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTranslation } from "react-i18next";

interface ReportConfig {
  type: "tickets" | "performance" | "sla" | "satisfaction";
  format: "csv" | "pdf" | "excel";
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
  filters: {
    status?: string[];
    priority?: string[];
    category?: string[];
    agent?: string[];
  };
}

interface ReportExporterProps {
  onExport?: (config: ReportConfig) => void;
}

export const ReportExporter = ({ onExport }: ReportExporterProps) => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ReportConfig>({
    type: "tickets",
    format: "csv",
    dateRange: { from: undefined, to: undefined },
    filters: {}
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<"from" | "to" | null>(null);

  const reportTypes = [
    { value: "tickets", label: "Ticket Report", icon: FileText },
    { value: "performance", label: "Agent Performance", icon: BarChart3 },
    { value: "sla", label: "SLA Compliance", icon: Clock },
    { value: "satisfaction", label: "Customer Satisfaction", icon: CheckCircle }
  ];

  const formatOptions = [
    { value: "csv", label: "CSV", icon: FileSpreadsheet, description: "Compatible with Excel" },
    { value: "excel", label: "Excel", icon: FileSpreadsheet, description: "Native Excel file" },
    { value: "pdf", label: "PDF", icon: FileText, description: "Formatted document" }
  ];

  const statusOptions = ["Pending", "In Progress", "Resolved", "Closed"];
  const priorityOptions = ["Low", "Medium", "High", "Critical"];
  const categoryOptions = ["IT", "Facilities", "HR", "Finance", "Operational"];
  const agentOptions = ["John Doe", "Jane Smith", "Pedro Costa", "Maria Santos"];

  const generateSampleData = () => {
    // Example data for demonstration
    const sampleData = {
      tickets: [
        ["ID", "Title", "Status", "Priority", "Category", "Agent", "Created At", "Resolved At"],
        ["TK-001", "Access Problem", "Resolved", "High", "IT", "John Doe", "2024-06-01", "2024-06-02"],
        ["TK-002", "Material Request", "Closed", "Medium", "Facilities", "Jane Smith", "2024-06-01", "2024-06-03"],
        ["TK-003", "Policy Question", "In Progress", "Low", "HR", "Pedro Costa", "2024-06-02", ""],
      ],
      performance: [
        ["Agent", "Resolved Calls", "Average Time", "Satisfaction"],
        ["John Doe", "45", "2.3 hours", "4.8/5"],
        ["Jane Smith", "38", "1.8 hours", "4.9/5"],
        ["Pedro Costa", "31", "3.1 hours", "4.6/5"],
      ]
    };

    return sampleData[config.type as keyof typeof sampleData] || sampleData.tickets;
  };

  const generateCSV = (data: string[][]) => {
    const csvContent = data.map(row => 
      row.map(cell => `"${cell}"`).join(",")
    ).join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_${config.type}_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generatePDF = () => {
    // In production, would use a library like jsPDF or call backend API
    // Em produção, usaria uma biblioteca como jsPDF ou chamaria API backend
    console.log("Gerando PDF...");
    
    // Simulação de geração de PDF
    const pdfContent = `
      RELATÓRIO DE ${config.type.toUpperCase()}
      
      Período: ${config.dateRange.from ? format(config.dateRange.from, "dd/MM/yyyy", { locale: ptBR }) : "N/A"} - ${config.dateRange.to ? format(config.dateRange.to, "dd/MM/yyyy", { locale: ptBR }) : "N/A"}
      
      Dados do relatório seriam inseridos aqui...
    `;
    
    const blob = new Blob([pdfContent], { type: "text/plain" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_${config.type}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async () => {
    setIsGenerating(true);
    
    try {
      const data = generateSampleData();
      
      if (config.format === "csv" || config.format === "excel") {
        generateCSV(data);
      } else if (config.format === "pdf") {
        generatePDF();
      }
      
      onExport?.(config);
      
      console.log("Relatório gerado:", config);
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
    } finally {
      setTimeout(() => setIsGenerating(false), 1000);
    }
  };

  const handleFilterChange = (filterType: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [filterType]: prev.filters[filterType as keyof typeof prev.filters]?.includes(value)
          ? prev.filters[filterType as keyof typeof prev.filters]?.filter(v => v !== value)
          : [...(prev.filters[filterType as keyof typeof prev.filters] || []), value]
      }
    }));
  };

  const getSelectedFiltersCount = () => {
    return Object.values(config.filters).reduce((count, arr) => count + (arr?.length || 0), 0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileDown className="h-5 w-5" />
          {t('reports.exportTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Report Type */}
        <div>
          <label className="block text-sm font-medium mb-2">{t('reports.typeLabel')}</label>
          <Select value={config.type} onValueChange={(value) => setConfig(prev => ({ ...prev, type: value as any }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {reportTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Format */}
        <div>
          <label className="block text-sm font-medium mb-2">{t('reports.formatLabel')}</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {formatOptions.map((format) => {
              const Icon = format.icon;
              const isSelected = config.format === format.value;
              
              return (
                <Button
                  key={format.value}
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => setConfig(prev => ({ ...prev, format: format.value as any }))}
                  className="h-auto p-3 flex flex-col items-start gap-1"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{format.label}</span>
                  </div>
                  <span className="text-xs opacity-70">{format.description}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium mb-2">{t('reports.periodLabel')}</label>
          <div className="grid grid-cols-2 gap-2">
            <Popover open={showDatePicker === "from"} onOpenChange={(open) => setShowDatePicker(open ? "from" : null)}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {config.dateRange.from ? format(config.dateRange.from, "dd/MM/yyyy", { locale: ptBR }) : t('reports.initialDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={config.dateRange.from}
                  onSelect={(date) => {
                    setConfig(prev => ({ ...prev, dateRange: { ...prev.dateRange, from: date } }));
                    setShowDatePicker(null);
                  }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>

            <Popover open={showDatePicker === "to"} onOpenChange={(open) => setShowDatePicker(open ? "to" : null)}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {config.dateRange.to ? format(config.dateRange.to, "dd/MM/yyyy", { locale: ptBR }) : t('reports.finalDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={config.dateRange.to}
                  onSelect={(date) => {
                    setConfig(prev => ({ ...prev, dateRange: { ...prev.dateRange, to: date } }));
                    setShowDatePicker(null);
                  }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Filters */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm font-medium">{t('reports.filtersLabel')}</label>
            {getSelectedFiltersCount() > 0 && (
              <Badge variant="secondary">
                {t('reports.selectedFilters', { count: getSelectedFiltersCount() })}
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">{t('reports.status')}</label>
              <div className="flex gap-1 flex-wrap">
                {statusOptions.map(status => (
                  <Badge
                    key={status}
                    variant={config.filters.status?.includes(status) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => handleFilterChange("status", status)}
                  >
                    {status}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block">{t('reports.priority')}</label>
              <div className="flex gap-1 flex-wrap">
                {priorityOptions.map(priority => (
                  <Badge
                    key={priority}
                    variant={config.filters.priority?.includes(priority) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => handleFilterChange("priority", priority)}
                  >
                    {priority}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block">{t('reports.category')}</label>
              <div className="flex gap-1 flex-wrap">
                {categoryOptions.map(category => (
                  <Badge
                    key={category}
                    variant={config.filters.category?.includes(category) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => handleFilterChange("category", category)}
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block">{t('reports.agent')}</label>
              <div className="flex gap-1 flex-wrap">
                {agentOptions.map(agent => (
                  <Badge
                    key={agent}
                    variant={config.filters.agent?.includes(agent) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => handleFilterChange("agent", agent)}
                  >
                    {agent.split(' ')[0]}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Export Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleExport}
            disabled={isGenerating}
            className="flex items-center gap-2"
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isGenerating ? t('reports.generating') : t('reports.generate')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
