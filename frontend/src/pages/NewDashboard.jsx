import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, API } from '../App';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { LogOut, Settings, Package, FileCheck, Clock, TrendingUp, ListOrdered } from 'lucide-react';

const NewDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState(30); // days

  const timeFilters = [
    { label: 'Today', days: 1 },
    { label: 'Last 3 Days', days: 3 },
    { label: 'Last Week', days: 7 },
    { label: 'Last Month', days: 30 },
    { label: 'Last 3 Months', days: 90 }
  ];

  useEffect(() => {
    fetchMetrics();
  }, [timeFilter]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/dashboard/metrics?days=${timeFilter}`);
      setMetrics(response.data);
    } catch (error) {
      toast.error('Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-700 border-red-200',
      order_uploader: 'bg-blue-100 text-blue-700 border-blue-200',
      pattern_maker: 'bg-green-100 text-green-700 border-green-200',
      pattern_checker: 'bg-purple-100 text-purple-700 border-purple-200',
      general_user: 'bg-slate-100 text-slate-700 border-slate-200'
    };
    return colors[role] || colors.general_user;
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Admin',
      order_uploader: 'Order Uploader',
      pattern_maker: 'Pattern Maker',
      pattern_checker: 'Pattern Checker',
      general_user: 'General User'
    };
    return labels[role] || role;
  };

  const formatTime = (hours) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} mins`;
    } else if (hours < 24) {
      return `${hours.toFixed(1)} hrs`;
    } else {
      return `${(hours / 24).toFixed(1)} days`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header */}
      <header className="glass border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
                Pattern <span className="gradient-text">Manager</span>
              </h1>
              <p className="text-sm text-slate-600 mt-0.5">Welcome, {user?.name}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge className={`${getRoleBadgeColor(user?.role)} border font-medium`}>
                {getRoleLabel(user?.role)}
              </Badge>
              
              {user?.role === 'admin' && (
                <Button
                  data-testid="admin-panel-button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="border-slate-300"
                >
                  <Settings className="w-4 h-4 mr-1.5" />
                  Admin Panel
                </Button>
              )}
              
              <Button
                data-testid="logout-button"
                variant="outline"
                size="sm"
                onClick={logout}
                className="border-slate-300"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>Dashboard</h2>
              <p className="text-slate-600 mt-1">Overview of pattern making operations</p>
            </div>
            
            <Button
              onClick={() => navigate('/orders')}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              <ListOrdered className="w-4 h-4 mr-1.5" />
              View All Orders
            </Button>
          </div>

          {/* Time Filter Tabs */}
          <Tabs value={timeFilter.toString()} onValueChange={(val) => setTimeFilter(parseInt(val))}>
            <TabsList className="bg-white">
              {timeFilters.map((filter) => (
                <TabsTrigger 
                  key={filter.days} 
                  value={filter.days.toString()}
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  {filter.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Metrics Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {[1, 2, 3, 4, 5].map(i => (
              <Card key={i} className="animate-shimmer" />
            ))}
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {/* Total Orders */}
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Package className="w-4 h-4 text-blue-600" />
                  Total Orders
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{metrics.total_orders}</div>
                <p className="text-xs text-slate-500 mt-1">In selected period</p>
              </CardContent>
            </Card>

            {/* Total Patterns */}
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <FileCheck className="w-4 h-4 text-green-600" />
                  Patterns Created
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{metrics.total_patterns}</div>
                <p className="text-xs text-slate-500 mt-1">All stages combined</p>
              </CardContent>
            </Card>

            {/* Approved Patterns */}
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Approved Patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{metrics.approved_patterns}</div>
                <p className="text-xs text-slate-500 mt-1">
                  {metrics.total_orders > 0 
                    ? `${Math.round((metrics.approved_patterns / metrics.total_orders) * 100)}% approval rate`
                    : 'No orders yet'
                  }
                </p>
              </CardContent>
            </Card>

            {/* Avg Pattern Making Time */}
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Clock className="w-4 h-4 text-purple-600" />
                  Avg Making Time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  {formatTime(metrics.avg_pattern_making_time_hours)}
                </div>
                <p className="text-xs text-slate-500 mt-1">Order to first pattern</p>
              </CardContent>
            </Card>

            {/* Avg Approval Time */}
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Clock className="w-4 h-4 text-orange-600" />
                  Avg Approval Time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  {formatTime(metrics.avg_approval_time_hours)}
                </div>
                <p className="text-xs text-slate-500 mt-1">Pattern to approval</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="text-center py-16">
            <CardContent>
              <p className="text-slate-500">No data available for the selected period</p>
            </CardContent>
          </Card>
        )}

        {/* Additional Info */}
        {metrics && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Period Summary</CardTitle>
              <CardDescription>
                Data from {new Date(metrics.date_range.start).toLocaleDateString()} to {new Date(metrics.date_range.end).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-slate-500">Period</div>
                  <div className="font-semibold">{metrics.date_range.days} days</div>
                </div>
                <div>
                  <div className="text-slate-500">Patterns per Order</div>
                  <div className="font-semibold">
                    {metrics.total_orders > 0 ? (metrics.total_patterns / metrics.total_orders).toFixed(1) : '0'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Total Processing Time</div>
                  <div className="font-semibold">
                    {formatTime(metrics.avg_pattern_making_time_hours + metrics.avg_approval_time_hours)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Status</div>
                  <div className="font-semibold text-green-600">Active</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default NewDashboard;
