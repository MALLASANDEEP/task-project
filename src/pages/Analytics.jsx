import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import * as api from '@/services/api';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
export default function Analytics() {
    const [tasks, setTasks] = useState([]);
    useEffect(() => {
        api.getTasks().then(setTasks).catch(() => setTasks([]));
    }, []);
    const byPriority = useMemo(() => {
        const high = tasks.filter((t) => t.priority === 'high').length;
        const medium = tasks.filter((t) => t.priority === 'medium').length;
        const low = tasks.filter((t) => t.priority === 'low').length;
        return [
            { label: 'High', count: high },
            { label: 'Medium', count: medium },
            { label: 'Low', count: low },
        ];
    }, [tasks]);
    const completionRate = tasks.length ? Math.round((tasks.filter((t) => t.status === 'completed').length / tasks.length) * 100) : 0;
    const onTimeRate = tasks.length
        ? Math.round((tasks.filter((t) => t.status === 'completed' && new Date(t.dueDate).getTime() >= new Date(t.createdAt).getTime()).length /
            tasks.length) *
            100)
        : 0;
    return (<div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Deeper delivery insights and operational trends.</p>
        </div>
        <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary">Updated live</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Task Load by Priority</CardTitle>
            <CardDescription>How your team workload is distributed</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byPriority}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
                <XAxis dataKey="label" axisLine={false} tickLine={false}/>
                <YAxis allowDecimals={false} axisLine={false} tickLine={false}/>
                <Tooltip />
                <Bar dataKey="count" fill="#4f46e5" radius={[10, 10, 0, 0]}/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery Health</CardTitle>
            <CardDescription>Key quality indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completion Rate</span>
                <span className="font-medium">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2"/>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">On-time Delivery</span>
                <span className="font-medium">{onTimeRate}%</span>
              </div>
              <Progress value={onTimeRate} className="h-2"/>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Recommendation</p>
              <p className="text-sm mt-1">Prioritize high-priority tasks in progress to improve completion velocity this week.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>);
}

