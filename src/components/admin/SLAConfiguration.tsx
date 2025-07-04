import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Clock, 
  Save, 
  RotateCcw,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SLAConfig {
  priority: string;
  responseTime: number; // em horas
  resolutionTime: number; // em horas
  escalationTime: number; // em horas
}

export const SLAConfiguration = () => {
  const { toast } = useToast();
  const [slaConfigs, setSlaConfigs] = useState<SLAConfig[]>([
    { priority: "urgent", responseTime: 1, resolutionTime: 4, escalationTime: 0.5 },
    { priority: "high", responseTime: 2, resolutionTime: 8, escalationTime: 1 },
    { priority: "medium", responseTime: 4, resolutionTime: 24, escalationTime: 2 },
    { priority: "low", responseTime: 8, resolutionTime: 72, escalationTime: 4 }
  ]);

  const [editingConfig, setEditingConfig] = useState<SLAConfig | null>(null);

  const priorityLabels = {
    urgent: "🔴 Crítica",
    high: "🟠 Alta",
    medium: "🟡 Média",
    low: "🟢 Baixa"
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
      case "low": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600";
    }
  };

  const handleEdit = (config: SLAConfig) => {
    setEditingConfig({ ...config });
  };

  const handleSave = () => {
    if (!editingConfig) return;

    setSlaConfigs(prev => 
      prev.map(config => 
        config.priority === editingConfig.priority ? editingConfig : config
      )
    );

    toast({
      title: "SLA Updated",
      description: `Configuration for ${priorityLabels[editingConfig.priority]} priority was saved successfully.`,
    });

    setEditingConfig(null);
  };

  const handleCancel = () => {
    setEditingConfig(null);
  };

  const resetToDefaults = () => {
    setSlaConfigs([
      { priority: "urgent", responseTime: 1, resolutionTime: 4, escalationTime: 0.5 },
      { priority: "high", responseTime: 2, resolutionTime: 8, escalationTime: 1 },
      { priority: "medium", responseTime: 4, resolutionTime: 24, escalationTime: 2 },
      { priority: "low", responseTime: 8, resolutionTime: 72, escalationTime: 4 }
    ]);

    toast({
      title: "Configurações Restauradas",
      description: "Todas as configurações de SLA foram restauradas para os valores padrão.",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg dark:text-gray-100">SLA Configuration by Priority</CardTitle>
            <Button
              onClick={resetToDefaults}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Restaurar Padrões
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {slaConfigs.map((config) => (
              <div key={config.priority} className="border rounded-lg p-4 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <Badge className={getPriorityColor(config.priority)}>
                    {priorityLabels[config.priority]}
                  </Badge>
                  {editingConfig?.priority === config.priority ? (
                    <div className="flex gap-2">
                      <Button onClick={handleSave} size="sm">
                        <Save className="h-4 w-4 mr-1" />
                        Salvar
                      </Button>
                      <Button onClick={handleCancel} variant="outline" size="sm">
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={() => handleEdit(config)} variant="outline" size="sm">
                      Editar
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1 mb-2 dark:text-gray-200">
                      <Clock className="h-4 w-4" />
                      Tempo de Resposta (horas)
                    </Label>
                    {editingConfig?.priority === config.priority ? (
                      <Input
                        type="number"
                        value={editingConfig.responseTime}
                        onChange={(e) => setEditingConfig({
                          ...editingConfig,
                          responseTime: Number(e.target.value)
                        })}
                        min="0.5"
                        step="0.5"
                        className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                      />
                    ) : (
                      <div className="p-2 bg-gray-50 rounded border dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 font-medium">
                        {config.responseTime}h
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1 mb-2 dark:text-gray-200">
                      <Clock className="h-4 w-4" />
                      Tempo de Resolução (horas)
                    </Label>
                    {editingConfig?.priority === config.priority ? (
                      <Input
                        type="number"
                        value={editingConfig.resolutionTime}
                        onChange={(e) => setEditingConfig({
                          ...editingConfig,
                          resolutionTime: Number(e.target.value)
                        })}
                        min="1"
                        step="1"
                        className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                      />
                    ) : (
                      <div className="p-2 bg-gray-50 rounded border dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 font-medium">
                        {config.resolutionTime}h
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1 mb-2 dark:text-gray-200">
                      <AlertTriangle className="h-4 w-4" />
                      Tempo de Escalação (horas)
                    </Label>
                    {editingConfig?.priority === config.priority ? (
                      <Input
                        type="number"
                        value={editingConfig.escalationTime}
                        onChange={(e) => setEditingConfig({
                          ...editingConfig,
                          escalationTime: Number(e.target.value)
                        })}
                        min="0.25"
                        step="0.25"
                        className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                      />
                    ) : (
                      <div className="p-2 bg-gray-50 rounded border dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 font-medium">
                        {config.escalationTime}h
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base dark:text-gray-100">Informações sobre SLA</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 text-blue-500 dark:text-blue-400" />
              <div>
                <strong className="dark:text-gray-200">Response Time:</strong> Maximum time for first response to ticket
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 text-green-500 dark:text-green-400" />
              <div>
                <strong className="dark:text-gray-200">Resolution Time:</strong> Maximum time for complete ticket resolution
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500 dark:text-orange-400" />
              <div>
                <strong className="dark:text-gray-200">Escalation Time:</strong> Time after which the ticket is automatically escalated if no response
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
