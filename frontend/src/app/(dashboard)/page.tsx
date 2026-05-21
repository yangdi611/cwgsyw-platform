import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">首页</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {['工作报告', '变更文档', '共享文档', '设备密码'].map((title) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">即将上线</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
