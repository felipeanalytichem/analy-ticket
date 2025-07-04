import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Search, ChevronDown, ChevronRight, Code, Bug, FileText, Copy, Download, ClipboardCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TestStep {
  description: string;
  status: 'passed' | 'failed';
  error?: string;
}

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'running' | 'pending';
  duration?: number;
  error?: string;
  errorStack?: string;
  component?: string;
  type: 'unit' | 'e2e' | 'accessibility' | 'performance';
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  steps?: TestStep[];
  errorContext?: {
    code?: string;
    suggestion?: string;
    relatedFiles?: string[];
  };
}

export function TestRunner() {
  const [activeTab, setActiveTab] = useState('all');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTests, setExpandedTests] = useState<string[]>([]);
  const [copiedErrors, setCopiedErrors] = useState<string[]>([]);
  const { toast } = useToast();

  const testSuites = {
    unit: [
      'Auth.test.tsx',
      'TicketList.test.tsx',
      'CategoryManagement.test.tsx',
      'SLAConfiguration.test.tsx',
      'TicketCreation.test.tsx'
    ],
    e2e: [
      'login.spec.ts',
      'tickets.spec.ts',
      'categories.spec.ts',
      'admin.spec.ts',
      'ticket-creation.spec.ts'
    ],
    accessibility: [
      'WCAG Compliance',
      'Keyboard Navigation',
      'Screen Reader Support',
      'Color Contrast'
    ],
    performance: [
      'Load Time',
      'First Contentful Paint',
      'Time to Interactive',
      'Bundle Size'
    ]
  };

  const toggleExpanded = (testName: string) => {
    setExpandedTests(prev => 
      prev.includes(testName)
        ? prev.filter(name => name !== testName)
        : [...prev, testName]
    );
  };

  const generateTestSteps = (testName: string): TestStep[] => {
    // Simulate test steps based on test type
    if (testName.includes('Auth')) {
      return [
        { description: 'Initialize authentication context', status: 'passed' },
        { description: 'Mock user credentials', status: 'passed' },
        { description: 'Submit login form', status: 'passed' },
        { description: 'Verify authentication state', status: 'failed', error: 'Expected user to be authenticated, but received null' }
      ];
    }
    if (testName.includes('Ticket')) {
      return [
        { description: 'Load ticket list component', status: 'passed' },
        { description: 'Mock API response', status: 'passed' },
        { description: 'Render ticket items', status: 'failed', error: 'TypeError: Cannot read properties of undefined (reading "map")' }
      ];
    }
    return [
      { description: 'Setup test environment', status: 'passed' },
      { description: 'Execute test case', status: Math.random() > 0.5 ? 'passed' : 'failed' }
    ];
  };

  const runTests = async (type?: string) => {
    setIsRunning(true);
    setProgress(0);
    setResults([]);
    setExpandedTests([]);

    const testsToRun = type && type !== 'all' 
      ? testSuites[type as keyof typeof testSuites]
      : Object.values(testSuites).flat();

    for (let i = 0; i < testsToRun.length; i++) {
      const test = testsToRun[i];
      setProgress((i / testsToRun.length) * 100);

      // Simulate test execution with more detailed results
      await new Promise(resolve => setTimeout(resolve, 1000));

      const failed = Math.random() > 0.8;
      const result: TestResult = {
        name: test,
        status: failed ? 'failed' : 'passed',
        duration: Math.floor(Math.random() * 1000),
        type: type as TestResult['type'] || 'unit',
        steps: generateTestSteps(test),
        coverage: {
          statements: Math.floor(Math.random() * 20 + 80),
          branches: Math.floor(Math.random() * 20 + 80),
          functions: Math.floor(Math.random() * 20 + 80),
          lines: Math.floor(Math.random() * 20 + 80)
        }
      };

      if (failed) {
        result.error = 'Test assertion failed';
        result.errorStack = `Error: Test assertion failed
    at Object.<anonymous> (${test}:42:12)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async Promise.all (index 0)`;
        result.errorContext = {
          code: 'expect(received).toBe(expected)\n\nExpected: true\nReceived: false',
          suggestion: 'Check if the component state is properly initialized before rendering',
          relatedFiles: ['src/components/Auth.tsx', 'src/contexts/AuthContext.tsx']
        };
      }

      setResults(prev => [...prev, result]);

      // Auto-expand failed tests
      if (failed) {
        setExpandedTests(prev => [...prev, test]);
      }
    }

    setIsRunning(false);
    setProgress(100);
  };

  const stats = {
    total: results.length,
    passed: results.filter(r => r.status === 'passed').length,
    failed: results.filter(r => r.status === 'failed').length,
    coverage: results.length > 0 ? {
      statements: Math.round(results.reduce((acc, r) => acc + (r.coverage?.statements || 0), 0) / results.length),
      branches: Math.round(results.reduce((acc, r) => acc + (r.coverage?.branches || 0), 0) / results.length),
      functions: Math.round(results.reduce((acc, r) => acc + (r.coverage?.functions || 0), 0) / results.length),
      lines: Math.round(results.reduce((acc, r) => acc + (r.coverage?.lines || 0), 0) / results.length)
    } : null
  };

  const filteredResults = results.filter(result =>
    result.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    result.error?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    result.steps?.some(step => 
      step.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      step.error?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const copyToClipboard = async (text: string, errorId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedErrors(prev => [...prev, errorId]);
      setTimeout(() => {
        setCopiedErrors(prev => prev.filter(id => id !== errorId));
      }, 2000);
      toast({
        title: "Copied to clipboard",
        description: "Error details have been copied to your clipboard.",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again or use the export function.",
        variant: "destructive",
      });
    }
  };

  const formatErrorDetails = (result: TestResult): string => {
    let details = `Test: ${result.name}\n`;
    details += `Status: ${result.status}\n`;
    details += `Duration: ${result.duration}ms\n\n`;

    if (result.steps) {
      details += 'Steps:\n';
      result.steps.forEach((step, index) => {
        details += `${index + 1}. ${step.description} - ${step.status}\n`;
        if (step.error) details += `   Error: ${step.error}\n`;
      });
      details += '\n';
    }

    if (result.error) {
      details += `Error: ${result.error}\n`;
      if (result.errorStack) details += `Stack Trace:\n${result.errorStack}\n`;
      if (result.errorContext) {
        if (result.errorContext.code) details += `\nCode Context:\n${result.errorContext.code}\n`;
        if (result.errorContext.suggestion) details += `\nSuggestion: ${result.errorContext.suggestion}\n`;
        if (result.errorContext.relatedFiles) {
          details += '\nRelated Files:\n';
          result.errorContext.relatedFiles.forEach(file => details += `- ${file}\n`);
        }
      }
    }

    if (result.coverage) {
      details += '\nCoverage:\n';
      details += `Statements: ${result.coverage.statements}%\n`;
      details += `Branches: ${result.coverage.branches}%\n`;
      details += `Functions: ${result.coverage.functions}%\n`;
      details += `Lines: ${result.coverage.lines}%\n`;
    }

    return details;
  };

  const exportTestResults = () => {
    try {
      let exportContent = `Test Results Summary\n`;
      exportContent += `==================\n\n`;
      exportContent += `Total Tests: ${stats.total}\n`;
      exportContent += `Passed: ${stats.passed}\n`;
      exportContent += `Failed: ${stats.failed}\n\n`;

      if (stats.coverage) {
        exportContent += `Overall Coverage:\n`;
        exportContent += `----------------\n`;
        exportContent += `Statements: ${stats.coverage.statements}%\n`;
        exportContent += `Branches: ${stats.coverage.branches}%\n`;
        exportContent += `Functions: ${stats.coverage.functions}%\n`;
        exportContent += `Lines: ${stats.coverage.lines}%\n\n`;
      }

      exportContent += `Detailed Test Results\n`;
      exportContent += `====================\n\n`;

      results.forEach((result, index) => {
        exportContent += `${index + 1}. ${formatErrorDetails(result)}\n`;
        exportContent += `${'='.repeat(50)}\n\n`;
      });

      const blob = new Blob([exportContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-results-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: "Test results have been exported to a text file.",
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description: "Failed to export test results. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Test Runner</h1>
        <div className="flex gap-2">
          {results.length > 0 && (
            <Button
              variant="outline"
              onClick={exportTestResults}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Results
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => runTests(activeTab)}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              'Run Tests'
            )}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All Tests</TabsTrigger>
          <TabsTrigger value="unit">Unit Tests</TabsTrigger>
          <TabsTrigger value="e2e">E2E Tests</TabsTrigger>
          <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>
      </Tabs>

      {results.length > 0 && (
        <Card className="mb-6 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Total:</span>
                <span className="ml-2 font-bold">{stats.total}</span>
              </div>
              <div>
                <span className="text-sm text-green-600">Passed:</span>
                <span className="ml-2 font-bold text-green-600">{stats.passed}</span>
              </div>
              <div>
                <span className="text-sm text-red-600">Failed:</span>
                <span className="ml-2 font-bold text-red-600">{stats.failed}</span>
              </div>
            </div>
            <Progress value={progress} className="w-1/3" />
          </div>

          {stats.coverage && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm font-medium mb-2">Coverage Report</div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Statements</div>
                  <div className="font-bold">{stats.coverage.statements}%</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Branches</div>
                  <div className="font-bold">{stats.coverage.branches}%</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Functions</div>
                  <div className="font-bold">{stats.coverage.functions}%</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Lines</div>
                  <div className="font-bold">{stats.coverage.lines}%</div>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <ScrollArea className="h-[600px] rounded-md border">
        <div className="p-4">
          {filteredResults.map((result, index) => (
            <Collapsible
              key={index}
              open={expandedTests.includes(result.name)}
              onOpenChange={() => toggleExpanded(result.name)}
              className="mb-4"
            >
              <Card className="p-4">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {result.status === 'passed' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : result.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      )}
                      <span className="font-medium">{result.name}</span>
                      <Badge variant={result.status === 'passed' ? 'default' : 'destructive'}>
                        {result.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        {result.duration}ms
                      </span>
                      {expandedTests.includes(result.name) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  {/* Test Steps */}
                  {result.steps && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">Test Steps</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(formatErrorDetails(result), `steps-${index}`);
                          }}
                          className="h-8 px-2"
                        >
                          {copiedErrors.includes(`steps-${index}`) ? (
                            <ClipboardCheck className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {result.steps.map((step, stepIndex) => (
                        <div
                          key={stepIndex}
                          className="flex items-start gap-2 text-sm pl-4 border-l-2"
                        >
                          {step.status === 'passed' ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                          )}
                          <div>
                            <div>{step.description}</div>
                            {step.error && (
                              <div className="text-red-600 mt-1">{step.error}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Error Information */}
                  {result.error && (
                    <Alert variant="destructive" className="mt-4">
                      <div className="flex items-center justify-between">
                        <AlertTitle className="flex items-center gap-2">
                          <Bug className="h-4 w-4" />
                          Error Details
                        </AlertTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(formatErrorDetails(result), `error-${index}`);
                          }}
                          className="h-8 px-2"
                        >
                          {copiedErrors.includes(`error-${index}`) ? (
                            <ClipboardCheck className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <AlertDescription>
                        <div className="mt-2 space-y-2">
                          <div className="font-medium">{result.error}</div>
                          {result.errorStack && (
                            <pre className="text-sm bg-red-950 p-2 rounded-md overflow-x-auto">
                              {result.errorStack}
                            </pre>
                          )}
                          {result.errorContext && (
                            <>
                              <div className="mt-4">
                                <div className="font-medium flex items-center gap-2">
                                  <Code className="h-4 w-4" />
                                  Code Context
                                </div>
                                <pre className="text-sm bg-red-950 p-2 rounded-md mt-1 overflow-x-auto">
                                  {result.errorContext.code}
                                </pre>
                              </div>
                              {result.errorContext.suggestion && (
                                <div className="mt-2">
                                  <div className="font-medium">Suggestion</div>
                                  <div className="text-sm">{result.errorContext.suggestion}</div>
                                </div>
                              )}
                              {result.errorContext.relatedFiles && (
                                <div className="mt-2">
                                  <div className="font-medium flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Related Files
                                  </div>
                                  <ul className="list-disc list-inside text-sm mt-1">
                                    {result.errorContext.relatedFiles.map((file, fileIndex) => (
                                      <li key={fileIndex}>{file}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Coverage Information */}
                  {result.coverage && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium mb-2">Test Coverage</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(formatErrorDetails(result), `coverage-${index}`);
                          }}
                          className="h-8 px-2"
                        >
                          {copiedErrors.includes(`coverage-${index}`) ? (
                            <ClipboardCheck className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground">Statements</div>
                          <div className="text-sm font-medium">{result.coverage.statements}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Branches</div>
                          <div className="text-sm font-medium">{result.coverage.branches}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Functions</div>
                          <div className="text-sm font-medium">{result.coverage.functions}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Lines</div>
                          <div className="text-sm font-medium">{result.coverage.lines}%</div>
                        </div>
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
} 