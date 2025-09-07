import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Receipt, 
  Calendar, 
  Camera, 
  TrendingUp, 
  Shield,
  Smartphone,
  Zap
} from "lucide-react";

export default function Landing() {
  const features = [
    {
      icon: MapPin,
      title: "GPS Tracking",
      description: "Automatic trip detection with adjustable sensitivity"
    },
    {
      icon: Receipt,
      title: "Expense Management",
      description: "Track business expenses with OCR receipt scanning"
    },
    {
      icon: Calendar,
      title: "Schedule Import",
      description: "Bulk import routes from Excel, CSV, or TXT files"
    },
    {
      icon: Camera,
      title: "Receipt OCR",
      description: "Extract data from receipts automatically"
    },
    {
      icon: TrendingUp,
      title: "Analytics",
      description: "Track mileage trends and expense patterns"
    },
    {
      icon: Shield,
      title: "Secure Storage",
      description: "Your data is encrypted and safely stored"
    }
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="landing-page">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            Route Rover
          </h1>
          <p className="text-xl text-muted-foreground mb-2">
            Professional mileage and expense tracking
          </p>
          <div className="flex items-center justify-center gap-2 mb-8">
            <Badge variant="secondary" className="bg-accent/10 text-accent">
              <Smartphone className="w-3 h-3 mr-1" />
              Mobile Optimized
            </Badge>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              <Zap className="w-3 h-3 mr-1" />
              Real-time GPS
            </Badge>
          </div>
          
          <Button 
            size="lg" 
            className="text-lg px-8 py-6 h-auto"
            onClick={() => window.location.href = '/api/login'}
            data-testid="login-button"
          >
            Get Started - Sign In
          </Button>
          
          <p className="text-sm text-muted-foreground mt-4">
            Sign in with your Replit account to continue
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="text-center">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Benefits Section */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <h2 className="text-2xl font-bold text-center mb-6">
              Why Choose MileTracker Pro?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold mb-3">For Business Professionals</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Accurate mileage tracking for tax deductions</li>
                  <li>• Automated expense categorization</li>
                  <li>• Professional reporting and exports</li>
                  <li>• Secure cloud backup and sync</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3">For Freelancers</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Track multiple client projects</li>
                  <li>• Receipt scanning for all expenses</li>
                  <li>• Schedule import for route planning</li>
                  <li>• Mobile-first design for on-the-go use</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center bg-muted/50 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-6">
            Join thousands of professionals who track their business expenses with MileTracker Pro
          </p>
          <Button 
            size="lg"
            onClick={() => window.location.href = '/api/login'}
            data-testid="cta-login-button"
          >
            Sign In Now
          </Button>
        </div>
      </div>
    </div>
  );
}