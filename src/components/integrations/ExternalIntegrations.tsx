import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  Slack, 
  Mail, 
  MessageCircle,
  Webhook,
  Settings,
  CheckCircle,
  AlertCircle,
  Send,
  Zap
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  icon: any;
  status: "connected" | "disconnected" | "error";
  description: string;
  lastSync?: string;
  config?: any;
}

interface ExternalIntegrationsProps {
  onIntegrationToggle?: (integrationId: string, enabled: boolean) => void;
}

export const ExternalIntegrations = ({ onIntegrationToggle }: ExternalIntegrationsProps) => {
  const { t } = useTranslation();
  const [integrations, setIntegrations] = useState<Integration[]>(() => [
    {
      id: "slack",
      name: "Slack",
      icon: Slack,
      status: "connected",
      description: t('integrations.slackDescription'),
      lastSync: "2024-06-05T16:30:00Z",
      config: { channel: "#support", webhook: "https://hooks.slack.com/..." }
    },
    {
      id: "email",
      name: "Email",
      icon: Mail,
      status: "connected", 
      description: t('integrations.emailDescription'),
      lastSync: "2024-06-05T16:25:00Z",
      config: { smtp: "smtp.gmail.com", port: 587 }
    },
    {
      id: "whatsapp",
      name: "WhatsApp Business",
      icon: MessageCircle,
      status: "disconnected",
      description: t('integrations.whatsappDescription'),
      config: { apiKey: "", phoneNumberId: "" }
    },
    {
      id: "zapier",
      name: "Zapier",
      icon: Zap,
      status: "error",
      description: t('integrations.zapierDescription'),
      config: { webhookUrl: "" }
    }
  ]);

  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState("");

  const handleToggleIntegration = (integrationId: string) => {
    setIntegrations(prev => prev.map(integration => 
      integration.id === integrationId 
        ? { 
            ...integration, 
            status: integration.status === "connected" ? "disconnected" : "connected" 
          }
        : integration
    ));
    
    const integration = integrations.find(i => i.id === integrationId);
    onIntegrationToggle?.(integrationId, integration?.status !== "connected");
  };

  const handleConfigUpdate = (integrationId: string, config: any) => {
    setIntegrations(prev => prev.map(integration => 
      integration.id === integrationId 
        ? { ...integration, config: { ...integration.config, ...config } }
        : integration
    ));
  };

  const handleTestIntegration = async (integrationId: string) => {
    console.log(`Testing integration ${integrationId} with message:`, testMessage);
    
    // Simular teste de integração
    try {
      // Em produção, faria chamada real para a API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIntegrations(prev => prev.map(integration => 
        integration.id === integrationId 
          ? { ...integration, lastSync: new Date().toISOString() }
          : integration
      ));
      
      console.log("Test completed successfully!");
    } catch (error) {
      console.error("Error during test:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected": return "text-green-600";
      case "error": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected": return CheckCircle;
      case "error": return AlertCircle;
      default: return Settings;
    }
  };

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return t('integrations.never');
    return new Date(dateString).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  };

  const selectedIntegrationData = integrations.find(i => i.id === selectedIntegration);

  return (
    <div className="space-y-6">
      {/* Integrations List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            {t('integrations.listTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {integrations.map((integration) => {
              const Icon = integration.icon;
              const StatusIcon = getStatusIcon(integration.status);
              
              return (
                <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-medium">{integration.name}</h3>
                      <p className="text-sm text-gray-600">{integration.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusIcon className={`h-4 w-4 ${getStatusColor(integration.status)}`} />
                        <span className={`text-xs capitalize ${getStatusColor(integration.status)}`}>
                          {integration.status === "connected" ? t('integrations.status.connected') : 
                           integration.status === "error" ? t('integrations.status.error') : t('integrations.status.disconnected')}
                        </span>
                        <span className="text-xs text-gray-500">
                          • {t('integrations.lastSync')}: {formatLastSync(integration.lastSync)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedIntegration(integration.id)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      {t('integrations.configure')}
                    </Button>
                    <Switch
                      checked={integration.status === "connected"}
                      onCheckedChange={() => handleToggleIntegration(integration.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Panel */}
      {selectedIntegrationData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t('integrations.configureTitle', { name: selectedIntegrationData.name })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Slack Configuration */}
            {selectedIntegration === "slack" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('integrations.webhookUrl')}</label>
                  <Input
                    value={selectedIntegrationData.config?.webhook || ""}
                    onChange={(e) => handleConfigUpdate("slack", { webhook: e.target.value })}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('integrations.channel')}</label>
                  <Input
                    value={selectedIntegrationData.config?.channel || ""}
                    onChange={(e) => handleConfigUpdate("slack", { channel: e.target.value })}
                    placeholder={t('integrations.channelPlaceholder')}
                  />
                </div>
              </div>
            )}

            {/* Email Configuration */}
            {selectedIntegration === "email" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('integrations.smtpServer')}</label>
                    <Input
                      value={selectedIntegrationData.config?.smtp || ""}
                      onChange={(e) => handleConfigUpdate("email", { smtp: e.target.value })}
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('integrations.port')}</label>
                    <Input
                      type="number"
                      value={selectedIntegrationData.config?.port || ""}
                      onChange={(e) => handleConfigUpdate("email", { port: e.target.value })}
                      placeholder="587"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('integrations.senderEmail')}</label>
                  <Input
                    type="email"
                    value={selectedIntegrationData.config?.fromEmail || ""}
                    onChange={(e) => handleConfigUpdate("email", { fromEmail: e.target.value })}
                    placeholder={t('integrations.senderEmailPlaceholder')}
                  />
                </div>
              </div>
            )}

            {/* WhatsApp Configuration */}
            {selectedIntegration === "whatsapp" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('integrations.apiKey')}</label>
                  <Input
                    type="password"
                    value={selectedIntegrationData.config?.apiKey || ""}
                    onChange={(e) => handleConfigUpdate("whatsapp", { apiKey: e.target.value })}
                    placeholder={t('integrations.apiKeyPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('integrations.phoneNumberId')}</label>
                  <Input
                    value={selectedIntegrationData.config?.phoneNumberId || ""}
                    onChange={(e) => handleConfigUpdate("whatsapp", { phoneNumberId: e.target.value })}
                    placeholder={t('integrations.phoneNumberIdPlaceholder')}
                  />
                </div>
              </div>
            )}

            {/* Zapier Configuration */}
            {selectedIntegration === "zapier" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('integrations.webhookUrl')}</label>
                  <Input
                    value={selectedIntegrationData.config?.webhookUrl || ""}
                    onChange={(e) => handleConfigUpdate("zapier", { webhookUrl: e.target.value })}
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                  />
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    {t('integrations.zapierHelp')}
                  </p>
                </div>
              </div>
            )}

            {/* Test Section */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium mb-2">{t('integrations.testIntegration')}</label>
              <div className="space-y-2">
                <Textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder={t('integrations.testMessagePlaceholder')}
                  className="min-h-20"
                />
                <Button
                  onClick={() => handleTestIntegration(selectedIntegration)}
                  disabled={!testMessage.trim()}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {t('integrations.sendTest')}
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setSelectedIntegration(null)}
              >
                {t('common.close')}
              </Button>
              <Button onClick={() => console.log("Config saved!")}>
                {t('integrations.saveConfig')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
