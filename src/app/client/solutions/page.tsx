import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck, Users, BarChart3, FileText, Monitor, Smartphone, Tablet, Shield,
} from "lucide-react";

const SOLUTIONS = [
  {
    category: "Assessment Types",
    items: [
      { name: "In-Basket Exercise", description: "Simulated management inbox prioritization", icon: ClipboardCheck },
      { name: "Role Play", description: "One-on-one or group behavioral simulation", icon: Users },
      { name: "Group Exercise", description: "Leaderless group discussion and collaboration", icon: Users },
      { name: "Case Study", description: "Business case analysis and presentation", icon: FileText },
      { name: "Oral Presentation", description: "Structured presentation on a business topic", icon: BarChart3 },
      { name: "Competency-Based Interview", description: "Structured behavioral interview", icon: ClipboardCheck },
    ],
  },
  {
    category: "Delivery Options",
    items: [
      { name: "Desktop", description: "Full-featured desktop browser experience", icon: Monitor },
      { name: "Tablet", description: "Optimized for iPad and tablet devices", icon: Tablet },
      { name: "Mobile", description: "Mobile-responsive assessment experience", icon: Smartphone },
    ],
  },
  {
    category: "Add-On Services",
    items: [
      { name: "Proctoring", description: "Live or AI-based monitoring during assessments", icon: Shield },
      { name: "Custom Reports", description: "Tailored report formats for your organization", icon: FileText },
      { name: "Analytics Dashboard", description: "Advanced talent analytics and benchmarking", icon: BarChart3 },
    ],
  },
];

export default function ClientSolutionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Solutions & Products</h1>
        <p className="mt-1 text-muted-foreground">
          Available assessment types, delivery options, and add-on services.
        </p>
      </div>

      {SOLUTIONS.map((section) => (
        <div key={section.category}>
          <h2 className="text-lg font-semibold mb-3">{section.category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.name} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-accent" />
                      </div>
                      <CardTitle className="text-sm">{item.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                    <Badge variant="outline" className="mt-2 text-xs">Available</Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
