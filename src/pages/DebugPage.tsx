import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationDebugger } from '@/components/debug/NotificationDebugger';
import { NotificationTester } from '@/components/notifications/NotificationTester';
import { ToastTester } from '@/components/debug/ToastTester';
import { Bug, Bell, TestTube, Layers } from 'lucide-react';
import { TestRunner } from '@/components/debug/TestRunner';

export const DebugPage: React.FC = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bug className="h-8 w-8" />
          Debug & Testes
        </h1>
        <p className="text-gray-600 mt-2">
          Ferramentas para debug e teste do sistema de notificações
        </p>
      </div>

      <Tabs defaultValue="toasts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="toasts" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Toast System
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Debug Notificações
          </TabsTrigger>
          <TabsTrigger value="tester" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Testador
          </TabsTrigger>
        </TabsList>

        <TabsContent value="toasts">
          <ToastTester />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationDebugger />
        </TabsContent>

        <TabsContent value="tester">
          <NotificationTester />
        </TabsContent>
      </Tabs>

      <div className="mt-6">
        <TestRunner />
      </div>
    </div>
  );
}; 