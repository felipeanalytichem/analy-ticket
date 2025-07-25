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
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-4 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Bug className="h-6 w-6 md:h-8 md:w-8" />
          Debug & Testes
        </h1>
        <p className="text-sm md:text-base text-gray-600 mt-2">
          Ferramentas para debug e teste do sistema de notificações
        </p>
      </div>

      <Tabs defaultValue="toasts" className="space-y-4 md:space-y-6">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 h-auto md:h-10">
          <TabsTrigger value="toasts" className="flex items-center gap-2 justify-center">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Toast System</span>
            <span className="sm:hidden">Toasts</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2 justify-center">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Debug Notificações</span>
            <span className="sm:hidden">Debug</span>
          </TabsTrigger>
          <TabsTrigger value="tester" className="flex items-center gap-2 justify-center">
            <TestTube className="h-4 w-4" />
            <span className="hidden sm:inline">Testador</span>
            <span className="sm:hidden">Test</span>
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